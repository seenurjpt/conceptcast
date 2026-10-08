/**
 * "I'm starting to learn <topic>" posts. One short model call in the author's
 * voice, no research and no critic, then the same machine checks every post
 * gets (in announcement mode) and the same review queue.
 */
import { z } from 'zod';
import type { Types } from 'mongoose';
import { callJson, MODELS, type SystemBlock } from './anthropic';
import { loadPrompt } from './loadPrompt';
import { Draft, type DraftDoc, type TopicDoc } from './db/models';
import { setUsageConcept } from './db/usageSink';
import { checkHardConstraints, ANNOUNCEMENT_MAX_HASHTAGS } from './pipeline/constraints';
import { extractHook } from './pipeline/generate';
import { loadVoiceContext } from './voice';

export const AnnouncementOutputSchema = z.object({
  body: z.string().min(50),
  hashtags: z.array(z.string()).min(3).max(ANNOUNCEMENT_MAX_HASHTAGS),
});

export interface AnnouncementOptions {
  /** Why the author is starting, in their words. The most interesting line of the post. */
  why?: string;
  /** What they want to be able to do ("fix a failing deploy without asking anyone"). The most quotable line. */
  goal?: string;
  /** e.g. "twice a week". Only mentioned when given. */
  cadence?: string;
}


/** `#Foo` and `Foo` both become `Foo`; spaces and symbols removed; deduped; at most 5. */
export function normalizeHashtags(tags: string[]): string[] {
  const out: string[] = [];
  for (const t of tags) {
    const clean = t.replace(/^#+/, '').replace(/[^A-Za-z0-9]/g, '');
    if (clean && /^[A-Za-z]/.test(clean) && !out.some((o) => o.toLowerCase() === clean.toLowerCase())) out.push(clean);
  }
  return out.slice(0, ANNOUNCEMENT_MAX_HASHTAGS);
}

/** Body, a blank line, then every hashtag on the final line (the machine checks require that). */
export function assembleAnnouncement(body: string, hashtags: string[]): string {
  const tags = normalizeHashtags(hashtags).map((h) => `#${h}`).join(' ');
  return tags ? `${body.trim()}\n\n${tags}` : body.trim();
}

/** The user message: the topic, what is coming, and only the extras the author supplied. */
/**
 * The user message: the topic, and only the extras the author supplied.
 *
 * Subtopics are deliberately not sent. People learn in whatever order they
 * choose, so a list of "what is coming" promises a syllabus they may not
 * follow, and trials showed the model mining those titles for invented
 * claims ("I can read about consistent hashing all day...").
 */
export function announcementPrompt(topic: Pick<TopicDoc, 'title' | 'description'>, opts: AnnouncementOptions = {}): string {
  const parts = [`# Topic\n\n${topic.title}`];
  if (topic.description?.trim()) {
    parts.push(`# What the topic covers (context only: do not list it, quote it or name concepts from it)\n\n${topic.description.trim()}`);
  }
  if (opts.why?.trim()) parts.push(`# Why I am starting\n\n${opts.why.trim()}`);
  else parts.push('# Why I am starting\n\n(not given: invent no reason, say nothing about my background, and make the hook about the topic)');
  if (opts.goal?.trim()) parts.push(`# What I want to be able to do\n\n${opts.goal.trim()}`);
  else parts.push('# What I want to be able to do\n\n(not given: state no goal)');
  if (opts.cadence?.trim()) parts.push(`# How often I will post\n\n${opts.cadence.trim()}`);
  else parts.push('# How often I will post\n\n(not given: do not promise a rhythm)');
  return parts.join('\n\n');
}

/**
 * The announce prompt plus the author's style guide, and nothing else from
 * the voice profile. Trials showed both other parts leak into the post as
 * made-up facts about the author: the audience description ("full-stack
 * devs who use LLM APIs") was restated as the author's own background, and
 * the long example posts pull a short announcement toward their length.
 */
export function announcementSystem(styleGuide: string): SystemBlock[] {
  const blocks: SystemBlock[] = [{ type: 'text', text: loadPrompt('announce') }];
  if (styleGuide.trim()) {
    blocks.push({ type: 'text', text: `# The author's voice notes (how they write, not facts about them)\n\n${styleGuide.trim()}` });
  }
  blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], cache_control: { type: 'ephemeral' } };
  return blocks;
}

export interface AnnouncementResult {
  draftId: string;
  body: string;
  violations: string[];
}

/**
 * Write the announcement and queue it for review. A pending announcement for
 * the same topic is replaced (rejected with a note), so "rewrite" is just
 * calling this again.
 */
export async function writeAnnouncement(
  topic: TopicDoc,
  opts: AnnouncementOptions = {},
  log: (m: string) => void = () => {},
): Promise<AnnouncementResult> {
  const system = announcementSystem((await loadVoiceContext()).styleGuide);
  const userMessage = announcementPrompt(topic, opts);

  setUsageConcept(`announce:${topic.slug}`);
  try {
    let out = await callJson({
      stage: 'announce',
      model: MODELS.heavy,
      system,
      maxTokens: 1_500,
      messages: [{ role: 'user', content: userMessage }],
      schema: AnnouncementOutputSchema,
    });
    let body = assembleAnnouncement(out.body, out.hashtags);
    let violations = checkHardConstraints(body, { kind: 'announcement' });

    // One corrective pass: it is a short, cheap call, and the checks are concrete.
    if (violations.length) {
      log(`announce: fixing ${violations.length} issue(s): ${violations.join('; ')}`);
      out = await callJson({
        stage: 'announce-fix',
        model: MODELS.heavy,
        system,
        maxTokens: 1_500,
        messages: [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: JSON.stringify(out) },
          {
            role: 'user',
            content: `That post fails these checks:\n${violations.map((v) => `- ${v}`).join('\n')}\n\nRewrite it so every check passes. Same JSON shape.`,
          },
        ],
        schema: AnnouncementOutputSchema,
      });
      body = assembleAnnouncement(out.body, out.hashtags);
      violations = checkHardConstraints(body, { kind: 'announcement' });
    }

    const previous = await Draft.find({ kind: 'announcement', topicId: topic._id, status: 'pending' }, { version: 1 }).lean<
      Pick<DraftDoc, '_id' | 'version'>[]
    >();
    const version = (await Draft.countDocuments({ kind: 'announcement', topicId: topic._id })) + 1;
    const doc = await Draft.create({
      kind: 'announcement',
      topicId: topic._id,
      conceptId: null,
      researchId: null,
      angle: 'announcement',
      hook: extractHook(body),
      body,
      charCount: body.length,
      hashtags: normalizeHashtags(out.hashtags).map((h) => `#${h}`),
      critique: null,
      announce: { why: opts.why?.trim() || null, goal: opts.goal?.trim() || null, cadence: opts.cadence?.trim() || null },
      version,
      status: 'pending',
    });
    if (previous.length) {
      await Draft.updateMany(
        { _id: { $in: previous.map((p) => p._id) } },
        { $set: { status: 'rejected', rejectionReason: `Replaced by a rewritten announcement (v${version})` } },
      );
    }
    log(`announce: saved draft ${doc._id} (${body.length} chars${violations.length ? `, ${violations.length} check(s) still failing` : ''})`);
    return { draftId: String(doc._id), body, violations };
  } finally {
    setUsageConcept(null);
  }
}

/** The latest announcement for a topic, for the topic page's state. */
export async function latestAnnouncement(
  topicId: Types.ObjectId | string,
): Promise<{ draftId: string; status: DraftDoc['status'] } | null> {
  const d = await Draft.findOne({ kind: 'announcement', topicId }, { status: 1 })
    .sort({ createdAt: -1 })
    .lean<Pick<DraftDoc, '_id' | 'status'>>();
  return d ? { draftId: String(d._id), status: d.status } : null;
}
