import { z } from 'zod';
import { handler, ok, readJson, HttpError, isObjectId } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { getTopic } from '@/lib/topics/service';
import { writeAnnouncement } from '@/lib/announce';

export const dynamic = 'force-dynamic';
/** One short model call, two at most. */
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  why: z.string().trim().max(400).optional(),
  goal: z.string().trim().max(200).optional(),
  cadence: z.string().trim().max(80).optional(),
});

/**
 * POST /api/topics/[id]/announce { why?, goal?, cadence? } → { draftId, violations }
 * Writes a short "I'm starting to learn this" post and queues it in Drafts.
 * Calling it again replaces a still-pending announcement for the topic.
 */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  if (!isObjectId(id)) throw new HttpError(400, 'Bad id.');
  const topic = await getTopic(userId, id);
  if (!topic) throw new HttpError(404, 'Topic not found.');
  const body = await readJson(req, Body);
  const result = await writeAnnouncement(topic, body);
  return ok(result, 201);
});
