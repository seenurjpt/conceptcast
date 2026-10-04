import { z } from 'zod';
import { handler, ok, readJson, HttpError, isObjectId } from '@/lib/api';
import { approveDraft, publishPublication } from '@/lib/publishing';
import { inngest, EVENTS } from '@/inngest/client';
import { Draft } from '@/lib/db/models';
import { watermarkWouldOverflow } from '@/lib/watermark';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  /** ISO datetime. Omit to publish now. */
  scheduledFor: z.iso.datetime({ offset: true }).optional(),
  /** Append the "Posted from conceptcast" line under the post. */
  watermark: z.boolean().default(false),
});

/** POST /api/drafts/[id]/approve { scheduledFor?, watermark? } */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (!isObjectId(id)) throw new HttpError(400, 'Bad id.');
  const body = await readJson(req, Body);
  if (body.watermark) {
    const current = await Draft.findById(id).select({ body: 1 }).lean<{ body: string } | null>();
    if (current && watermarkWouldOverflow(current.body)) {
      throw new HttpError(400, 'With the watermark this post passes LinkedIn’s 3000 character limit. Shorten it or turn the watermark off.');
    }
  }
  const when = body.scheduledFor ? new Date(body.scheduledFor) : undefined;
  const { draft, publication } = await approveDraft(id, when, { watermark: body.watermark });

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
