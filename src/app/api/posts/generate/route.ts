import { z } from 'zod';
import { handler, ok, readJson, HttpError, isObjectId } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { Concept } from '@/lib/db/models';
import { generationRuns, getDb, COLLECTIONS } from '@/lib/db/collections';
import { inngest, POST_EVENTS, type PostRequestedData } from '@/inngest/client';
import type { GenerationRunDoc } from '@/lib/schemas/post';

export const dynamic = 'force-dynamic';

const Body = z.object({
  topicId: z.string(),
  /** Bypass the once-per-day idempotency key. */
  force: z.boolean().default(false),
});

/** POST /api/posts/generate { topicId, force? } → { runId } (202). */
export const POST = handler(async (req: Request) => {
  const userId = await requireUserId();
  const body = await readJson(req, Body);
  if (!isObjectId(body.topicId)) throw new HttpError(400, 'topicId must be a concept id.');
  const topic = await Concept.findById(body.topicId).select({ _id: 1 }).lean();
  if (!topic) throw new HttpError(404, 'Topic not found.');

  const today = new Date().toISOString().slice(0, 10);

  // The Inngest idempotency key drops a second event for the same
  // user+topic+day, which would leave a fresh run doc queued forever; reuse
  // today's run instead unless the caller forces a new one.
  if (!body.force) {
    const db = await getDb();
    const existing = await db.collection<GenerationRunDoc>(COLLECTIONS.generationRuns).findOne(
      { userId, topicId: body.topicId, startedAt: { $gte: new Date(`${today}T00:00:00.000Z`) }, status: { $ne: 'failed' } },
      { sort: { startedAt: -1 } },
    );
    if (existing) return ok({ runId: String(existing._id), status: existing.status, reused: true }, 200);
  }

  const run = await generationRuns.create(userId, body.topicId);
  const data: PostRequestedData = {
    userId,
    topicId: body.topicId,
    runId: String(run._id),
    dateBucket: body.force ? `${today}:${String(run._id)}` : today,
    force: body.force,
  };
  try {
    await inngest.send({ name: POST_EVENTS.postRequested, data });
  } catch (e) {
    await generationRuns.update(run._id, { status: 'failed', error: `enqueue failed: ${(e as Error).message}`, finishedAt: new Date() });
    throw new HttpError(503, `Could not enqueue the run: ${(e as Error).message}`);
  }
  return ok({ runId: String(run._id), status: 'queued' }, 202);
});
