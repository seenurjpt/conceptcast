/**
 * Topics: a main topic ("System Design") groups subtopics, and each subtopic
 * is a Concept row so the existing research → write → critique pipeline runs
 * on it unchanged.
 */
import type { Types } from 'mongoose';
import { Concept, Topic, type ConceptDoc, type TopicDoc } from '../db/models';
import { TRACKS } from '../concepts/seed';
import { callJson, MODELS } from '../anthropic';
import { setUsageConcept } from '../db/usageSink';
import { loadPrompt } from '../loadPrompt';
import { SuggestSubtopicsSchema, type SuggestSubtopicsOutput } from '../schemas';
import { slugify, uniqueSlug, trackTopic, dedupeSuggestions, isMine } from './helpers';

export interface TopicCounts {
  backlog: number;
  selected: number;
  published: number;
  retired: number;
  total: number;
}
/** `mine`: created by this user, or a shared topic they started. */
export type TopicSummary = TopicDoc & { counts: TopicCounts; mine: boolean };

const emptyCounts = (): TopicCounts => ({ backlog: 0, selected: 0, published: 0, retired: 0, total: 0 });

/** A topic is visible if it is shared (migrated from a track) or yours. */
export function visibleTo(userId: string) {
  return { archived: false, $or: [{ ownerUserId: null }, { ownerUserId: userId }] };
}

/**
 * Idempotent migration: every legacy track with concepts that have no topic
 * becomes a shared main topic, and those concepts are attached to it. Runs on
 * each topic list read, so a concept created by the older routes (proposals,
 * the news scanner) is picked up on the next load rather than orphaned.
 */
export async function ensureTrackTopics(): Promise<number> {
  const orphans = await Concept.aggregate<{ _id: string; n: number }>([
    { $match: { topicId: null, track: { $in: [...TRACKS] } } },
    { $group: { _id: '$track', n: { $sum: 1 } } },
  ]);
  let attached = 0;
  for (const o of orphans) {
    const meta = trackTopic(o._id);
    if (!meta) continue;
    const topic = await Topic.findOneAndUpdate(
      { slug: meta.slug, ownerUserId: null },
      { $setOnInsert: { ...meta, ownerUserId: null, origin: 'migrated', archived: false, createdAt: new Date() } },
      { upsert: true, new: true },
    ).lean<TopicDoc>();
    if (!topic) continue;
    const r = await Concept.updateMany({ topicId: null, track: o._id }, { $set: { topicId: topic._id } });
    attached += r.modifiedCount;
  }
  return attached;
}

export async function listTopics(userId: string): Promise<TopicSummary[]> {
  await ensureTrackTopics();
  // Your own topics first, then the shared ones, each group oldest-first.
  const topics = await Topic.find(visibleTo(userId)).sort({ origin: -1, createdAt: 1 }).lean<TopicDoc[]>();
  if (topics.length === 0) return [];

  const rows = await Concept.aggregate<{ _id: { topicId: Types.ObjectId; status: string }; n: number }>([
    { $match: { topicId: { $in: topics.map((t) => t._id) } } },
    { $group: { _id: { topicId: '$topicId', status: '$status' }, n: { $sum: 1 } } },
  ]);
  const counts = new Map<string, TopicCounts>();
  for (const r of rows) {
    const key = String(r._id.topicId);
    const c = counts.get(key) ?? emptyCounts();
    if (r._id.status in c) c[r._id.status as keyof Omit<TopicCounts, 'total'>] += r.n;
    c.total += r.n;
    counts.set(key, c);
  }
  // Yours (created or started) first; the query's order holds within each group.
  return topics
    .map((t) => ({ ...t, counts: counts.get(String(t._id)) ?? emptyCounts(), mine: isMine(t, userId) }))
    .sort((a, b) => Number(b.mine) - Number(a.mine));
}

/**
 * Start a shared topic: it becomes one of yours without copying anything, so
 * its subtopics, research and drafts stay single. Your own topics are already
 * yours, so this only applies to shared ones. Returns null if not found.
 */
export async function startTopic(userId: string, id: Types.ObjectId | string): Promise<TopicDoc | null> {
  return Topic.findOneAndUpdate(
    { _id: id, archived: false, ownerUserId: null },
    { $addToSet: { startedBy: userId } },
    { returnDocument: 'after' },
  ).lean<TopicDoc>();
}

/** Stop a shared topic you started. Drafts and published posts are kept. */
export async function stopTopic(userId: string, id: Types.ObjectId | string): Promise<TopicDoc | null> {
  return Topic.findOneAndUpdate({ _id: id, ownerUserId: null }, { $pull: { startedBy: userId } }, { returnDocument: 'after' }).lean<TopicDoc>();
}

export async function getTopic(userId: string, id: Types.ObjectId | string): Promise<TopicDoc | null> {
  return Topic.findOne({ _id: id, ...visibleTo(userId) }).lean<TopicDoc>();
}

export async function createTopic(
  userId: string,
  input: { title: string; description?: string },
): Promise<TopicDoc> {
  const taken = new Set((await Topic.find({}, { slug: 1 }).lean<{ slug: string }[]>()).map((t) => t.slug));
  const doc = await Topic.create({
    ownerUserId: userId,
    slug: uniqueSlug(slugify(input.title), taken),
    title: input.title.trim(),
    description: (input.description ?? '').trim(),
    origin: 'user',
  });
  return doc.toObject() as TopicDoc;
}

export async function updateTopic(
  userId: string,
  id: Types.ObjectId | string,
  patch: { title?: string; description?: string },
): Promise<TopicDoc | null> {
  const set: Partial<TopicDoc> = {};
  if (patch.title !== undefined) set.title = patch.title.trim();
  if (patch.description !== undefined) set.description = patch.description.trim();
  return Topic.findOneAndUpdate({ _id: id, ...visibleTo(userId) }, { $set: set }, { new: true }).lean<TopicDoc>();
}

/** Archive the topic and retire whatever was still waiting under it. Reversible by hand. */
export async function archiveTopic(userId: string, id: Types.ObjectId | string): Promise<boolean> {
  const topic = await Topic.findOneAndUpdate({ _id: id, ...visibleTo(userId) }, { $set: { archived: true } }).lean<TopicDoc>();
  if (!topic) return false;
  await Concept.updateMany({ topicId: topic._id, status: 'backlog' }, { $set: { status: 'retired' } });
  return true;
}

export async function listSubtopics(topicId: Types.ObjectId | string): Promise<ConceptDoc[]> {
  return Concept.find({ topicId }).sort({ createdAt: 1, slug: 1 }).lean<ConceptDoc[]>();
}

export async function addSubtopic(
  topic: TopicDoc,
  input: { title: string; focus?: string },
  origin: 'user' | 'suggested' = 'user',
): Promise<ConceptDoc> {
  const taken = new Set((await Concept.find({}, { slug: 1 }).lean<{ slug: string }[]>()).map((c) => c.slug));
  const doc = await Concept.create({
    slug: uniqueSlug(slugify(input.title), taken),
    title: input.title.trim(),
    track: 'custom',
    topicId: topic._id,
    focus: (input.focus ?? '').trim(),
    origin,
    status: 'backlog',
  });
  return doc.toObject() as ConceptDoc;
}

/** One cheap model call: what is worth a post under this topic? */
export async function suggestSubtopics(topic: TopicDoc, existingTitles: string[]): Promise<SuggestSubtopicsOutput['subtopics']> {
  setUsageConcept(`topic:${topic.slug}`);
  try {
    const out = await callJson({
      stage: 'suggest-subtopics',
      model: MODELS.light,
      system: [{ type: 'text', text: loadPrompt('suggest-subtopics'), cache_control: { type: 'ephemeral' } }],
      maxTokens: 3_000,
      messages: [
        {
          role: 'user',
          content:
            `# Topic\n\n${topic.title}${topic.description ? `\n\n${topic.description}` : ''}\n\n` +
            `# Already covered (do not repeat)\n\n${existingTitles.length ? existingTitles.map((t) => `- ${t}`).join('\n') : '(nothing yet)'}`,
        },
      ],
      schema: SuggestSubtopicsSchema,
    });
    return dedupeSuggestions(existingTitles, out.subtopics);
  } finally {
    setUsageConcept(null);
  }
}

/** Suggest, then create each suggestion as a subtopic. Returns what was added. */
export async function suggestAndAddSubtopics(topic: TopicDoc): Promise<{ added: ConceptDoc[]; proposed: number }> {
  const existing = await listSubtopics(topic._id);
  const suggestions = await suggestSubtopics(topic, existing.map((c) => c.title));
  const added: ConceptDoc[] = [];
  for (const s of suggestions) added.push(await addSubtopic(topic, s, 'suggested'));
  return { added, proposed: suggestions.length };
}
