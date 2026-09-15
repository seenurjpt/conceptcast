import { handler, ok } from '@/lib/api';
import { Publication, Draft, Concept, type PublicationDoc, type DraftDoc, type ConceptDoc } from '@/lib/db/models';
import { engagementScore, trackStats } from '@/lib/feedback';

export const dynamic = 'force-dynamic';

/** GET /api/publications?from=ISO&to=ISO — calendar + analytics feed. */
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
    Concept.find({ _id: { $in: publications.map((p) => p.conceptId) } }).lean<ConceptDoc[]>(),
    trackStats(),
  ]);
  const draftById = new Map(drafts.map((d) => [String(d._id), d]));
  const conceptById = new Map(concepts.map((c) => [String(c._id), c]));
  return ok({
    publications: publications.map((p) => {
      const d = draftById.get(String(p.draftId));
      const c = conceptById.get(String(p.conceptId));
      return {
        ...p,
        hook: d?.hook ?? '',
        angle: d?.angle ?? null,
        criticScore: d?.critique.score ?? null,
        concept: c ? { slug: c.slug, title: c.title, track: c.track } : null,
        engagement: p.metrics ? engagementScore(p.metrics) : null,
      };
    }),
    trackStats: stats,
  });
});
