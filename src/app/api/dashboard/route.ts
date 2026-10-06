import { handler, ok } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { Concept, Draft, Publication, Topic, VoiceProfile, type ConceptDoc, type DraftDoc, type PublicationDoc, type TopicDoc } from '@/lib/db/models';
import { llmCalls } from '@/lib/db/collections';
import { availableProviders } from '@/lib/llm/client';
import { authState, getAuth } from '@/lib/publishers/linkedin';
import { engagementScore } from '@/lib/feedback';
import { listTopics } from '@/lib/topics/service';
import { releaseStaleClaims } from '@/lib/pipeline/generate';
import { customTitle } from '@/lib/customPost';

export const dynamic = 'force-dynamic';

/** Chart ranges the dashboard offers, in weeks. The quality score always uses the last 8. */
const RANGES = [8, 12, 26] as const;
const SCORE_WEEKS = 8;
const DAY = 86_400_000;

/** Monday 00:00 (server time) of the week containing `d`. */
function weekStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/**
 * GET /api/dashboard: everything the signed-in home screen shows, in one
 * request. Counts are cheap aggregates; lists are capped at a handful of rows.
 */
export const GET = handler(async (req: Request) => {
  const asked = Number(new URL(req.url).searchParams.get('weeks'));
  const WEEKS: number = (RANGES as readonly number[]).includes(asked) ? asked : 8;
  const userId = await requireUserId();
  await releaseStaleClaims();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstWeek = new Date(weekStart(now).getTime() - (WEEKS - 1) * 7 * DAY);
  const prevFirstWeek = new Date(firstWeek.getTime() - WEEKS * 7 * DAY);
  const scoreSince = new Date(weekStart(now).getTime() - (SCORE_WEEKS - 1) * 7 * DAY);
  const draftsSince = new Date(Math.min(prevFirstWeek.getTime(), scoreSince.getTime()));

  const [auth, providers, voice, topics, draftCounts, pending, recentDrafts, publications, spend] = await Promise.all([
    getAuth(),
    availableProviders(userId),
    VoiceProfile.findOne({ key: 'singleton' }, { styleGuide: 1, examplePosts: 1 }).lean<{ styleGuide: string; examplePosts: string[] } | null>(),
    listTopics(userId),
    Draft.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Draft.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(5).lean<DraftDoc[]>(),
    Draft.find({ createdAt: { $gte: draftsSince } }, { createdAt: 1, critique: 1 }).lean<Pick<DraftDoc, 'createdAt' | 'critique'>[]>(),
    Publication.find({}).sort({ scheduledFor: -1 }).limit(300).lean<PublicationDoc[]>(),
    llmCalls.spendSince(userId, monthStart),
  ]);

  /* ── titles for the rows we show ── */
  const published = publications.filter((p) => p.status === 'published');
  const upcoming = publications
    .filter((p) => p.status === 'scheduled' && p.scheduledFor.getTime() >= now.getTime())
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())
    .slice(0, 3);
  const recentPublished = [...published]
    .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
    .slice(0, 5);
  const shownPubs = [...upcoming, ...recentPublished];
  const pubDrafts = await Draft.find({ _id: { $in: shownPubs.map((p) => p.draftId) } }).lean<DraftDoc[]>();
  const draftById = new Map(pubDrafts.map((d) => [String(d._id), d]));

  const conceptIds = [...pending.map((d) => d.conceptId), ...shownPubs.map((p) => p.conceptId)].filter(Boolean);
  const concepts = await Concept.find({ _id: { $in: conceptIds } }, { title: 1, topicId: 1 }).lean<Pick<ConceptDoc, '_id' | 'title' | 'topicId'>[]>();
  const conceptById = new Map(concepts.map((c) => [String(c._id), c]));
  const topicIds = [
    ...concepts.map((c) => c.topicId),
    ...pending.map((d) => d.topicId),
    ...pubDrafts.map((d) => d.topicId),
  ].filter(Boolean);
  const topicDocs = await Topic.find({ _id: { $in: topicIds } }, { title: 1 }).lean<Pick<TopicDoc, '_id' | 'title'>[]>();
  const topicTitle = new Map(topicDocs.map((t) => [String(t._id), t.title]));

  const titleFor = (d: DraftDoc | undefined, conceptId: unknown) => {
    if (d?.kind === 'custom') return { title: customTitle(d.hook), topic: 'Your post' };
    if (d?.kind === 'announcement') {
      return { title: `Starting ${topicTitle.get(String(d.topicId)) ?? 'a new topic'}`, topic: 'Announcement' };
    }
    const c = conceptId ? conceptById.get(String(conceptId)) : undefined;
    return {
      title: c?.title ?? d?.hook?.slice(0, 80) ?? 'Untitled draft',
      topic: c?.topicId ? (topicTitle.get(String(c.topicId)) ?? null) : null,
    };
  };

  /* ── activity: drafts written per week ── */
  const weeks = Array.from({ length: WEEKS }, (_, i) => ({
    start: new Date(firstWeek.getTime() + i * 7 * DAY).toISOString(),
    drafts: 0,
  }));
  let previousTotal = 0;
  for (const d of recentDrafts) {
    const i = Math.floor((weekStart(d.createdAt).getTime() - firstWeek.getTime()) / (7 * DAY));
    if (i >= 0 && i < WEEKS) weeks[i].drafts += 1;
    else if (d.createdAt >= prevFirstWeek && d.createdAt < firstWeek) previousTotal += 1;
  }

  /* ── quality and engagement ── */
  const scores = recentDrafts
    .filter((d) => d.createdAt >= scoreSince)
    .map((d) => d.critique?.score)
    .filter((s): s is number => typeof s === 'number');
  const withMetrics = published.filter((p) => p.metrics);
  const engagement = withMetrics.reduce(
    (acc, p) => ({
      reactions: acc.reactions + (p.metrics?.reactions ?? 0),
      comments: acc.comments + (p.metrics?.comments ?? 0),
      shares: acc.shares + (p.metrics?.shares ?? 0),
    }),
    { reactions: 0, comments: 0, shares: 0 },
  );

  /* ── topics: yours, with progress ── */
  const mine = topics.filter((t) => t.mine);
  const toWrite = mine.reduce((n, t) => n + t.counts.backlog, 0);

  const counts = Object.fromEntries(draftCounts.map((r) => [r._id, r.n])) as Record<string, number>;
  const state = authState(auth);

  return ok({
    member: { name: auth?.memberName ?? null },
    setup: {
      aiKey: providers.length > 0,
      linkedin: state === 'ok' || state === 'refresh-due',
      voice: Boolean(voice && (voice.styleGuide?.trim() || voice.examplePosts?.length)),
      topic: mine.length > 0,
      firstPost: published.length > 0,
    },
    stats: {
      published: published.length,
      publishedThisMonth: published.filter((p) => p.publishedAt && p.publishedAt >= monthStart).length,
      pending: counts.pending ?? 0,
      oldestPendingAt: pending[0]?.createdAt ?? null,
      toWrite,
      activeTopics: mine.length,
      spendUsd: spend.costUsd,
      calls: spend.calls,
      providers,
      avgScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
      scoredDrafts: scores.length,
      engagement,
      measuredPosts: withMetrics.length,
    },
    weeks,
    range: { weeks: WEEKS, previousTotal },
    pending: pending.map((d) => ({
      _id: String(d._id),
      ...titleFor(d, d.conceptId),
      score: d.critique?.score ?? null,
      passed: d.critique?.depthPassed ?? null,
      angle: d.angle ?? null,
      createdAt: d.createdAt,
    })),
    topics: mine.slice(0, 6).map((t) => ({
      _id: String(t._id),
      title: t.title,
      published: t.counts.published,
      inFlight: t.counts.selected,
      toWrite: t.counts.backlog,
      total: t.counts.total - t.counts.retired,
    })),
    upcoming: upcoming.map((p) => ({
      _id: String(p._id),
      ...titleFor(draftById.get(String(p.draftId)), p.conceptId),
      scheduledFor: p.scheduledFor,
    })),
    recent: recentPublished.map((p) => ({
      _id: String(p._id),
      ...titleFor(draftById.get(String(p.draftId)), p.conceptId),
      publishedAt: p.publishedAt,
      postUrn: p.postUrn,
      metrics: p.metrics ? { reactions: p.metrics.reactions, comments: p.metrics.comments, shares: p.metrics.shares } : null,
      engagement: p.metrics ? engagementScore(p.metrics) : null,
    })),
  });
});
