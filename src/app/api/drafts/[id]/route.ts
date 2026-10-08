import { z } from 'zod';
import { handler, ok, readJson, HttpError, isObjectId } from '@/lib/api';
import {
  Draft,
  Concept,
  Research,
  Publication,
  Topic,
  type DraftDoc,
  type ConceptDoc,
  type ResearchDoc,
  type PublicationDoc,
  type TopicDoc,
} from '@/lib/db/models';
import { editDraft, rejectDraft } from '@/lib/publishing';
import { checkHardConstraints } from '@/lib/pipeline/constraints';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/drafts/[id]: draft + concept + research (sources) + publication. */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (!isObjectId(id)) throw new HttpError(400, 'Bad id.');
  const draft = await Draft.findById(id).lean<DraftDoc>();
  if (!draft) throw new HttpError(404, 'Draft not found.');
  const kind = draft.kind ?? 'post';
  // An announcement has no concept or research; it belongs to a main topic directly.
  const [concept, research, publication, previous, topic] = await Promise.all([
    draft.conceptId ? Concept.findById(draft.conceptId).lean<ConceptDoc>() : null,
    draft.researchId ? Research.findById(draft.researchId).lean<ResearchDoc>() : null,
    Publication.findOne({ draftId: draft._id }).lean<PublicationDoc>(),
    draft.critique?.revisionOf ? Draft.findById(draft.critique.revisionOf).lean<DraftDoc>() : null,
    draft.topicId ? Topic.findById(draft.topicId, { title: 1, description: 1 }).lean<Pick<TopicDoc, '_id' | 'title' | 'description'>>() : null,
  ]);
  return ok({
    draft: { ...draft, kind },
    concept,
    research,
    publication,
    previous,
    topic,
    constraintViolations: checkHardConstraints(draft.body, { kind, term: draft.term }),
  });
});

const Patch = z.object({
  body: z.string().min(1).max(3000).optional(),
  status: z.literal('rejected').optional(),
  reason: z.string().max(500).optional(),
});

/** PATCH /api/drafts/[id]: human edit-in-place, or reject with a reason. */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (!isObjectId(id)) throw new HttpError(400, 'Bad id.');
  const body = await readJson(req, Patch);
  if (body.status === 'rejected') {
    const draft = await rejectDraft(id, body.reason);
    return ok({ draft });
  }
  if (body.body === undefined) throw new HttpError(400, 'Nothing to update.');
  const draft = await editDraft(id, body.body);
  return ok({ draft, constraintViolations: checkHardConstraints(draft.body, { kind: draft.kind ?? 'post', term: draft.term }) });
});
