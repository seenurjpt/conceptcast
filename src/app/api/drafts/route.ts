import { handler, ok, HttpError } from '@/lib/api';
import {
  Draft,
  Concept,
  Publication,
  DRAFT_STATUSES,
  type DraftDoc,
  type ConceptDoc,
  type PublicationDoc,
  type DraftStatus,
} from '@/lib/db/models';

export const dynamic = 'force-dynamic';

/** GET /api/drafts?status=pending — the review queue. */
export const GET = handler(async (req: Request) => {
  const status = new URL(req.url).searchParams.get('status') ?? 'pending';
  if (status !== 'all' && !(DRAFT_STATUSES as readonly string[]).includes(status)) {
    throw new HttpError(400, `status must be one of ${DRAFT_STATUSES.join(', ')} or all.`);
  }
  const filter = status === 'all' ? {} : { status: status as DraftStatus };
  const drafts = await Draft.find(filter).sort({ createdAt: -1 }).limit(200).lean<DraftDoc[]>();
  const conceptIds = [...new Set(drafts.map((d) => String(d.conceptId)))];
  const [concepts, publications] = await Promise.all([
    Concept.find({ _id: { $in: conceptIds } }).lean<ConceptDoc[]>(),
    Publication.find({ draftId: { $in: drafts.map((d) => d._id) } }).lean<PublicationDoc[]>(),
  ]);
  const conceptById = new Map(concepts.map((c) => [String(c._id), c]));
  const pubByDraft = new Map(publications.map((p) => [String(p.draftId), p]));
  return ok({
    drafts: drafts.map((d) => ({
      ...d,
      concept: conceptById.get(String(d.conceptId)) ?? null,
      publication: pubByDraft.get(String(d._id)) ?? null,
    })),
  });
});
