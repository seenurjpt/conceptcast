import { z } from 'zod';
import { handler, ok, readJson, HttpError, isObjectId } from '@/lib/api';
import { approveDraft, publishPublication } from '@/lib/publishing';
import { inngest, EVENTS } from '@/inngest/client';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  /** ISO datetime. Omit to publish now. */
  scheduledFor: z.iso.datetime({ offset: true }).optional(),
});

/** POST /api/drafts/[id]/approve { scheduledFor? } */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (!isObjectId(id)) throw new HttpError(400, 'Bad id.');
  const body = await readJson(req, Body);
  const when = body.scheduledFor ? new Date(body.scheduledFor) : undefined;
  const { draft, publication } = await approveDraft(id, when);

  // "Now" (or already past): publish inline so the user sees the result immediately.
  if (publication.scheduledFor.getTime() <= Date.now() + 30_000) {
    const outcome = await publishPublication(publication._id);
    if (outcome.status === 'published') {
      try {
        await inngest.send({ name: EVENTS.published, data: { publicationId: outcome.publicationId } });
      } catch (e) {
        console.error(`inngest.send failed (metrics timer not started): ${(e as Error).message}`);
      }
    }
    return ok({ draft, publication: { ...publication, ...outcome }, outcome });
  }
  return ok({ draft, publication, outcome: { status: 'scheduled' } });
});
