import { z } from 'zod';
import { handler, ok, readJson, HttpError, isObjectId } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { getTopic, listSubtopics, updateTopic, archiveTopic } from '@/lib/topics/service';
import { releaseStaleClaims } from '@/lib/pipeline/generate';
import { kickResearchPool } from '@/lib/research/service';

export const dynamic = 'force-dynamic';
/** Opening a topic tops up the research pool after the response. */
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/topics/[id] → { topic, subtopics } (every status; the page filters). */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  if (!isObjectId(id)) throw new HttpError(400, 'Bad id.');
  const topic = await getTopic(userId, id);
  if (!topic) throw new HttpError(404, 'Topic not found.');
  // Put back anything an interrupted run left claimed, so it is writable again.
  await releaseStaleClaims();
  kickResearchPool('topic page opened');
  return ok({ topic, subtopics: await listSubtopics(topic._id) });
});

const Patch = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(600).optional(),
});

/** PATCH /api/topics/[id] { title?, description? } */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  if (!isObjectId(id)) throw new HttpError(400, 'Bad id.');
  const body = await readJson(req, Patch);
  const topic = await updateTopic(userId, id, body);
  if (!topic) throw new HttpError(404, 'Topic not found.');
  return ok({ topic });
});

/** DELETE /api/topics/[id]: archive it and retire its waiting subtopics. */
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  if (!isObjectId(id)) throw new HttpError(400, 'Bad id.');
  if (!(await archiveTopic(userId, id))) throw new HttpError(404, 'Topic not found.');
  return ok({ archived: true });
});
