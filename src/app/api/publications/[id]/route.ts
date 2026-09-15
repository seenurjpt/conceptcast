import { z } from 'zod';
import { handler, ok, readJson, HttpError, isObjectId } from '@/lib/api';
import { Publication, type PublicationDoc } from '@/lib/db/models';
import { recordMetrics, fetchAndRecordMetrics, publishPublication } from '@/lib/publishing';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const Patch = z.object({
  /** Reschedule (only while still scheduled/failed). */
  scheduledFor: z.iso.datetime({ offset: true }).optional(),
  /** Manual "how did this do?" (spec §8 fallback). */
  metrics: z
    .object({
      impressions: z.number().int().min(0).nullable().default(null),
      reactions: z.number().int().min(0),
      comments: z.number().int().min(0),
      shares: z.number().int().min(0).default(0),
    })
    .optional(),
});

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (!isObjectId(id)) throw new HttpError(400, 'Bad id.');
  const body = await readJson(req, Patch);

  if (body.metrics) {
    const { delta } = await recordMetrics(id, { ...body.metrics, source: 'manual' });
    const publication = await Publication.findById(id).lean<PublicationDoc>();
    return ok({ publication, feedbackDelta: delta });
  }
  if (body.scheduledFor) {
    const publication = await Publication.findOneAndUpdate(
      { _id: id, status: { $in: ['scheduled', 'failed'] } },
      { $set: { scheduledFor: new Date(body.scheduledFor), status: 'scheduled', error: null } },
      { new: true },
    ).lean<PublicationDoc>();
    if (!publication) throw new HttpError(409, 'Publication not found or already published.');
    return ok({ publication });
  }
  throw new HttpError(400, 'Nothing to update.');
});

const Post = z.object({ action: z.enum(['publish-now', 'fetch-metrics']) });

/** POST /api/publications/[id] { action } — publish immediately or pull metrics now. */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (!isObjectId(id)) throw new HttpError(400, 'Bad id.');
  const { action } = await readJson(req, Post);
  if (action === 'publish-now') {
    await Publication.updateOne({ _id: id, status: 'failed' }, { $set: { status: 'scheduled', error: null } });
    return ok({ outcome: await publishPublication(id) });
  }
  return ok({ outcome: await fetchAndRecordMetrics(id) });
});

/** DELETE /api/publications/[id] — unschedule (draft returns to approved). */
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (!isObjectId(id)) throw new HttpError(400, 'Bad id.');
  const r = await Publication.deleteOne({ _id: id, status: { $in: ['scheduled', 'failed'] } });
  if (r.deletedCount === 0) throw new HttpError(409, 'Publication not found or already published.');
  return ok({ deleted: true });
});
