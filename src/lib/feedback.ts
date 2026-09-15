import type { Types } from 'mongoose';
import {
  Concept,
  Draft,
  Publication,
  type ConceptDoc,
  type DraftDoc,
  type PublicationDoc,
  type PublicationMetrics,
} from './db/models';

/**
 * One number per post. Comments and shares are weighted because they cost the
 * reader more than a reaction; impressions (manual only) add a small term so
 * a widely seen post with few reactions still registers.
 */
export function engagementScore(m: Pick<PublicationMetrics, 'reactions' | 'comments' | 'shares' | 'impressions'>): number {
  return m.reactions + 3 * m.comments + 5 * m.shares + (m.impressions ?? 0) / 200;
}

export interface RecentPost {
  publicationId: string;
  conceptSlug: string;
  title: string;
  track: string;
  hook: string;
  publishedAt: Date;
  engagement: number | null;
  metrics: PublicationMetrics | null;
}

/** The last N published posts, newest first, with engagement where known (spec §8 use 1). */
export async function recentPublished(limit = 10): Promise<RecentPost[]> {
  const pubs = await Publication.find({ status: 'published' })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .lean<PublicationDoc[]>();
  if (pubs.length === 0) return [];

  const [drafts, concepts] = await Promise.all([
    Draft.find({ _id: { $in: pubs.map((p) => p.draftId) } }).lean<DraftDoc[]>(),
    Concept.find({ _id: { $in: pubs.map((p) => p.conceptId) } }).lean<ConceptDoc[]>(),
  ]);
  const draftById = new Map(drafts.map((d) => [String(d._id), d]));
  const conceptById = new Map(concepts.map((c) => [String(c._id), c]));

  return pubs.map((p) => {
    const d = draftById.get(String(p.draftId));
    const c = conceptById.get(String(p.conceptId));
    return {
      publicationId: String(p._id),
      conceptSlug: c?.slug ?? '?',
      title: c?.title ?? '?',
      track: c?.track ?? '?',
      hook: d?.hook ?? '',
      publishedAt: p.publishedAt ?? p.createdAt,
      engagement: p.metrics ? engagementScore(p.metrics) : null,
      metrics: p.metrics,
    };
  });
}

/** Tracks of the most recent posts (published or in flight), newest first — for the eligibility filter. */
export async function recentTracks(limit = 2): Promise<string[]> {
  const concepts = await Concept.find({ status: { $in: ['published', 'selected'] }, coveredAt: { $ne: null } })
    .sort({ coveredAt: -1 })
    .limit(limit)
    .lean<Pick<ConceptDoc, 'track'>[]>();
  return concepts.map((c) => c.track);
}

export interface TrackStats {
  track: string;
  posts: number;
  scored: number;
  avgEngagement: number | null;
  avgReactions: number | null;
  avgComments: number | null;
  avgCritic: number | null;
}

/** Engagement by track for the analytics screen and the feedback nudge. */
export async function trackStats(): Promise<TrackStats[]> {
  const pubs = await Publication.find({ status: 'published' }).lean<PublicationDoc[]>();
  const [drafts, concepts] = await Promise.all([
    Draft.find({ _id: { $in: pubs.map((p) => p.draftId) } }).lean<DraftDoc[]>(),
    Concept.find({ _id: { $in: pubs.map((p) => p.conceptId) } }).lean<ConceptDoc[]>(),
  ]);
  const draftById = new Map(drafts.map((d) => [String(d._id), d]));
  const conceptById = new Map(concepts.map((c) => [String(c._id), c]));

  const acc = new Map<string, { posts: number; eng: number[]; re: number[]; co: number[]; cr: number[] }>();
  for (const p of pubs) {
    const c = conceptById.get(String(p.conceptId));
    const d = draftById.get(String(p.draftId));
    if (!c) continue;
    const a = acc.get(c.track) ?? { posts: 0, eng: [], re: [], co: [], cr: [] };
    a.posts += 1;
    if (p.metrics) {
      a.eng.push(engagementScore(p.metrics));
      a.re.push(p.metrics.reactions);
      a.co.push(p.metrics.comments);
    }
    if (d) a.cr.push(d.critique.score);
    acc.set(c.track, a);
  }
  const avg = (xs: number[]): number | null => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  return [...acc.entries()]
    .map(([track, a]) => ({
      track,
      posts: a.posts,
      scored: a.eng.length,
      avgEngagement: avg(a.eng),
      avgReactions: avg(a.re),
      avgComments: avg(a.co),
      avgCritic: avg(a.cr),
    }))
    .sort((x, y) => (y.avgEngagement ?? -1) - (x.avgEngagement ?? -1));
}

const NUDGE_MAX = 0.5;
const MIN_SCORED_FOR_FEEDBACK = 3;

/**
 * Spec §8 use 2: nudge `devRelevance` of every backlog concept in a track up or
 * down based on that track's rolling average versus the overall average.
 * Applied once per publication (guarded by `feedbackAppliedAt`), bounded to
 * ±0.5 per application, clamped to 0–10. Returns the delta applied (0 if skipped).
 */
export async function applyEngagementFeedback(publicationId: Types.ObjectId | string): Promise<number> {
  const pub = await Publication.findById(publicationId).lean<PublicationDoc>();
  if (!pub || !pub.metrics || pub.feedbackAppliedAt) return 0;

  const stats = await trackStats();
  const scored = stats.filter((s) => s.avgEngagement !== null);
  const totalScored = scored.reduce((s, t) => s + t.scored, 0);
  if (totalScored < MIN_SCORED_FOR_FEEDBACK) return 0;

  const concept = await Concept.findById(pub.conceptId).lean<ConceptDoc>();
  if (!concept) return 0;
  const mine = stats.find((s) => s.track === concept.track);
  if (!mine || mine.avgEngagement === null) return 0;

  const overall =
    scored.reduce((s, t) => s + (t.avgEngagement as number) * t.scored, 0) / Math.max(totalScored, 1);
  const relative = (mine.avgEngagement - overall) / Math.max(overall, 1);
  const delta = Math.max(-NUDGE_MAX, Math.min(NUDGE_MAX, relative * NUDGE_MAX));

  if (Math.abs(delta) > 0.01) {
    const backlog = await Concept.find({ track: concept.track, status: 'backlog' }).lean<ConceptDoc[]>();
    await Concept.bulkWrite(
      backlog.map((c) => ({
        updateOne: {
          filter: { _id: c._id },
          update: {
            $set: { devRelevance: Math.max(0, Math.min(10, Math.round((c.devRelevance + delta) * 100) / 100)) },
          },
        },
      })),
    );
  }
  await Publication.updateOne({ _id: pub._id }, { $set: { feedbackAppliedAt: new Date() } });
  return delta;
}
