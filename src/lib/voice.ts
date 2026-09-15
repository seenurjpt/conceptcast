import { callJson, MODELS } from './anthropic';
import {
  VoiceProfile,
  Draft,
  Publication,
  DEFAULT_AUDIENCE,
  type VoiceProfileDoc,
  type PublicationDoc,
} from './db/models';
import { VoiceExtractSchema } from './schemas';
import { engagementScore } from './feedback';
import { loadPrompt } from './loadPrompt';

/** What the writer and critic receive on every call (spec §6). */
export interface VoiceContext {
  styleGuide: string;
  audienceDescription: string;
  /** Up to three few-shot posts: best-performing published posts, else the hand-pasted examples. */
  examplePosts: string[];
}

export async function getVoiceProfile(): Promise<VoiceProfileDoc> {
  const existing = await VoiceProfile.findOne({ key: 'singleton' }).lean<VoiceProfileDoc>();
  if (existing) return existing;
  const created = await VoiceProfile.create({ key: 'singleton' });
  return created.toObject() as VoiceProfileDoc;
}

/** The three best-performing published posts, by engagement score. */
export async function topPerformingPosts(limit = 3): Promise<string[]> {
  const pubs = await Publication.find({ status: 'published', metrics: { $ne: null } }).lean<
    Pick<PublicationDoc, 'draftId' | 'metrics'>[]
  >();
  const scored = pubs
    .map((p) => ({ draftId: p.draftId, score: p.metrics ? engagementScore(p.metrics) : 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  if (scored.length === 0) return [];
  const drafts = await Draft.find({ _id: { $in: scored.map((s) => s.draftId) } }).lean<{ _id: unknown; body: string }[]>();
  const byId = new Map(drafts.map((d) => [String(d._id), d.body]));
  return scored.map((s) => byId.get(String(s.draftId))).filter((b): b is string => Boolean(b));
}

export async function loadVoiceContext(): Promise<VoiceContext> {
  const profile = await getVoiceProfile();
  const top = await topPerformingPosts(3);
  const examples = top.length >= 3 ? top : [...top, ...profile.examplePosts].slice(0, 3);
  return {
    styleGuide: profile.styleGuide,
    audienceDescription: profile.audienceDescription || DEFAULT_AUDIENCE,
    examplePosts: examples,
  };
}

/** One Sonnet call turns 8–15 pasted posts into a style guide (spec §6 step 2). */
export async function extractStyleGuide(posts: string[]): Promise<string> {
  const clean = posts.map((p) => p.trim()).filter((p) => p.length > 0);
  if (clean.length < 3) throw new Error('Paste at least 3 posts to extract a style guide (8–15 is ideal).');
  const out = await callJson({
    stage: 'voice-extract',
    model: MODELS.heavy,
    system: [{ type: 'text', text: loadPrompt('voice-extract') }],
    maxTokens: 6_000,
    messages: [
      {
        role: 'user',
        content: clean.map((p, i) => `<post n="${i + 1}">\n${p}\n</post>`).join('\n\n'),
      },
    ],
    schema: VoiceExtractSchema,
  });
  return out.styleGuide;
}

/**
 * Monthly refresh (spec §6 step 4): re-extract from the author's own top
 * performers once there are enough of them. Returns false when skipped.
 */
export async function refreshVoiceFromTopPerformers(): Promise<boolean> {
  const top = await topPerformingPosts(15);
  if (top.length < 8) return false;
  const styleGuide = await extractStyleGuide(top);
  await VoiceProfile.updateOne(
    { key: 'singleton' },
    { $set: { styleGuide, updatedAt: new Date() } },
    { upsert: true },
  );
  return true;
}
