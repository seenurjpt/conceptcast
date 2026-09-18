/**
 * Backlog growth (spec §14.5): a monthly job proposes 10 new concepts for the
 * human to accept or reject. Accepting creates a real backlog concept after
 * re-validating the prerequisite DAG.
 */
import type { Types } from 'mongoose';
import { callJson, MODELS } from '../anthropic';
import { loadPrompt } from '../loadPrompt';
import { Concept, ConceptProposal, type ConceptDoc, type ConceptProposalDoc } from '../db/models';
import { ProposalOutputSchema } from '../schemas';
import { TRACKS, type Track } from './seed';
import { validateDag } from './dag';

export async function proposeConcepts(): Promise<ConceptProposalDoc[]> {
  const existing = await Concept.find({}, { slug: 1, title: 1, track: 1 }).lean<Pick<ConceptDoc, 'slug' | 'title' | 'track'>[]>();
  const pending = await ConceptProposal.find({ status: 'pending' }, { slug: 1 }).lean<Pick<ConceptProposalDoc, 'slug'>[]>();
  const taken = new Set([...existing.map((c) => c.slug), ...pending.map((p) => p.slug)]);

  const out = await callJson({
    stage: 'propose-concepts',
    model: MODELS.heavy,
    system: [{ type: 'text', text: loadPrompt('propose'), cache_control: { type: 'ephemeral' } }],
    maxTokens: 12_000,
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 10 }],
    messages: [
      {
        role: 'user',
        content:
          `# Existing backlog (slug — title [track])\n\n` +
          existing.map((c) => `${c.slug} — ${c.title} [${c.track}]`).join('\n') +
          (pending.length ? `\n\n# Already proposed, awaiting review\n\n${pending.map((p) => p.slug).join('\n')}` : ''),
      },
    ],
    schema: ProposalOutputSchema,
  });

  const fresh = out.proposals.filter(
    (p) => !taken.has(p.slug) && (TRACKS as readonly string[]).includes(p.track),
  );
  if (fresh.length === 0) return [];
  const docs = await ConceptProposal.insertMany(
    fresh.map((p) => ({
      ...p,
      track: p.track as Track,
      difficulty: p.difficulty as 1 | 2 | 3,
      status: 'pending',
    })),
  );
  return docs.map((d) => d.toObject() as ConceptProposalDoc);
}

/** Accept: create the concept, keeping the DAG valid. Unknown prerequisites are dropped with a note. */
export async function acceptProposal(id: Types.ObjectId | string): Promise<ConceptDoc> {
  const p = await ConceptProposal.findById(id).lean<ConceptProposalDoc>();
  if (!p) throw new Error('Proposal not found.');
  if (p.status !== 'pending') throw new Error(`Proposal already ${p.status}.`);
  if (await Concept.exists({ slug: p.slug })) throw new Error(`Concept "${p.slug}" already exists.`);

  const all = await Concept.find({}, { slug: 1, prerequisites: 1 }).lean<Pick<ConceptDoc, 'slug' | 'prerequisites'>[]>();
  const known = new Set(all.map((c) => c.slug));
  const prerequisites = p.prerequisites.filter((s) => known.has(s));
  const dropped = p.prerequisites.filter((s) => !known.has(s));
  validateDag([...all, { slug: p.slug, prerequisites }]);

  const concept = await Concept.create({
    slug: p.slug,
    title: p.title,
    track: p.track,
    oneLiner: p.oneLiner,
    focus: p.focus,
    prerequisites,
    difficulty: p.difficulty,
    primarySources: p.primarySources,
    devRelevance: p.devRelevance,
    status: 'backlog',
    origin: p.source === 'news' ? 'news' : 'proposal',
    storyDate: p.story?.newestAt ?? null,
    note: dropped.length
      ? `Accepted from proposal; dropped unknown prerequisites: ${dropped.join(', ')}`
      : p.source === 'news' && p.story
        ? `From the news: ${p.story.headline}`
        : null,
  });
  await ConceptProposal.updateOne({ _id: p._id }, { $set: { status: 'accepted' } });
  return concept.toObject() as ConceptDoc;
}

export async function rejectProposal(id: Types.ObjectId | string): Promise<void> {
  const r = await ConceptProposal.updateOne({ _id: id, status: 'pending' }, { $set: { status: 'rejected' } });
  if (r.matchedCount === 0) throw new Error('Proposal not found or not pending.');
}
