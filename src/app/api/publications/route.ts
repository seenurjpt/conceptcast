import { handler, ok } from '@/lib/api';
import { Publication, Draft, Concept, Topic, type PublicationDoc, type DraftDoc, type ConceptDoc, type TopicDoc } from '@/lib/db/models';
import { engagementScore, trackStats } from '@/lib/feedback';
import { customTitle } from '@/lib/customPost';

export const dynamic = 'force-dynamic';

/** GET /api/publications?from=ISO&to=ISO: calendar + analytics feed. */
export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const filter: Record<string, unknown> = {};
  if (from || to) {
    filter.scheduledFor = {
      ...(from ? { $gte: new Date(from) } : {}),
      ...(to ? { $lte: new Date(to) } : {}),
    };
  }
  const publications = await Publication.find(filter).sort({ scheduledFor: -1 }).limit(500).lean<PublicationDoc[]>();
  const [drafts, concepts, stats] = await Promise.all([
    Draft.find({ _id: { $in: publications.map((p) => p.draftId) } }).lean<DraftDoc[]>(),
    Concept.find({ _id: { $in: publications.map((p) => p.conceptId).filter(Boolean) } }).lean<ConceptDoc[]>(),
    trackStats(),
  ]);
  const draftById = new Map(drafts.map((d) => [String(d._id), d]));
  const conceptById = new Map(concepts.map((c) => [String(c._id), c]));
  const topicIds = drafts.filter((d) => d.kind === 'announcement' && d.topicId).map((d) => d.topicId);
  const topics = topicIds.length ? await Topic.find({ _id: { $in: topicIds } }, { title: 1 }).lean<Pick<TopicDoc, '_id' | 'title'>[]>() : [];
  const topicTitle = new Map(topics.map((t) => [String(t._id), t.title]));
  return ok({
    publications: publications.map((p) => {
      const d = draftById.get(String(p.draftId));
      const c = p.conceptId ? conceptById.get(String(p.conceptId)) : undefined;
      // Announcements have no subtopic; present them with the same shape so the
      // calendar and analytics rows need no special case.
      const announcement =
        d?.kind === 'announcement'
          ? { slug: 'announcement', title: `Starting ${topicTitle.get(String(d.topicId)) ?? 'a new topic'}`, track: 'announcement' }
          : d?.kind === 'custom'
            ? { slug: 'your-post', title: customTitle(d.hook), track: 'your-post' }
            : null;
      return {
        ...p,
        hook: d?.hook ?? '',
        angle: d?.angle ?? null,
        criticScore: d?.critique?.score ?? null,
        concept: c ? { slug: c.slug, title: c.title, track: c.track } : announcement,
        engagement: p.metrics ? engagementScore(p.metrics) : null,
      };
    }),
    trackStats: stats,
  });
});
