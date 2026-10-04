import { handler, ok, HttpError } from '@/lib/api';
import {
  Draft,
  Concept,
  Publication,
  Topic,
  DRAFT_STATUSES,
  type DraftDoc,
  type ConceptDoc,
  type PublicationDoc,
  type DraftStatus,
  type TopicDoc,
} from '@/lib/db/models';

export const dynamic = 'force-dynamic';

/** GET /api/drafts?status=pending: the review queue. */
export const GET = handler(async (req: Request) => {
  const status = new URL(req.url).searchParams.get('status') ?? 'pending';
  if (status !== 'all' && !(DRAFT_STATUSES as readonly string[]).includes(status)) {
    throw new HttpError(400, `status must be one of ${DRAFT_STATUSES.join(', ')} or all.`);
  }
  const filter = status === 'all' ? {} : { status: status as DraftStatus };
  const drafts = await Draft.find(filter).sort({ createdAt: -1 }).limit(200).lean<DraftDoc[]>();
  const conceptIds = [...new Set(drafts.map((d) => d.conceptId).filter(Boolean).map(String))];
  const [concepts, publications] = await Promise.all([
    Concept.find({ _id: { $in: conceptIds } }).lean<ConceptDoc[]>(),
    Publication.find({ draftId: { $in: drafts.map((d) => d._id) } }).lean<PublicationDoc[]>(),
  ]);
  const conceptById = new Map(concepts.map((c) => [String(c._id), c]));
  const pubByDraft = new Map(publications.map((p) => [String(p.draftId), p]));
  // The main topic each draft belongs to, for the "Topic › Subtopic" line.
  // Announcements carry their topic directly.
  const topicIds = [
    ...new Set([...concepts.map((c) => c.topicId), ...drafts.map((d) => d.topicId)].filter(Boolean).map(String)),
  ];
  const topics = topicIds.length
    ? await Topic.find({ _id: { $in: topicIds } }, { title: 1 }).lean<Pick<TopicDoc, '_id' | 'title'>[]>()
    : [];
  const topicById = new Map(topics.map((t) => [String(t._id), { _id: String(t._id), title: t.title }]));
  return ok({
    drafts: drafts.map((d) => {
      const concept = d.conceptId ? (conceptById.get(String(d.conceptId)) ?? null) : null;
      const topicId = d.topicId ?? concept?.topicId ?? null;
      return {
        ...d,
        kind: d.kind ?? 'post',
        concept,
        topic: topicId ? (topicById.get(String(topicId)) ?? null) : null,
        publication: pubByDraft.get(String(d._id)) ?? null,
      };
    }),
  });
});
