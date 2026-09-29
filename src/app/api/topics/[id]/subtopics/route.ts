import { z } from 'zod';
import { handler, ok, readJson, HttpError, isObjectId } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { getTopic, addSubtopic } from '@/lib/topics/service';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  title: z.string().trim().min(3).max(120),
  /** One line for the researcher. Optional: the title alone is enough to start. */
  focus: z.string().trim().max(300).optional(),
});

/** POST /api/topics/[id]/subtopics { title, focus? } → { subtopic } */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  if (!isObjectId(id)) throw new HttpError(400, 'Bad id.');
  const topic = await getTopic(userId, id);
  if (!topic) throw new HttpError(404, 'Topic not found.');
  const body = await readJson(req, Body);
  const subtopic = await addSubtopic(topic, body, 'user');
  return ok({ subtopic }, 201);
});
