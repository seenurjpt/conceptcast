import { handler, ok, HttpError, isObjectId } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { getTopic, startTopic, stopTopic } from '@/lib/topics/service';
import { kickResearchPool } from '@/lib/research/service';

export const dynamic = 'force-dynamic';
/** Starting a topic moves its subtopics up the research pool, topped up after the response. */
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

async function sharedTopicOr404(userId: string, id: string) {
  if (!isObjectId(id)) throw new HttpError(400, 'Bad id.');
  const topic = await getTopic(userId, id);
  if (!topic) throw new HttpError(404, 'Topic not found.');
  if (topic.ownerUserId !== null) throw new HttpError(409, 'This is already one of your topics.');
  return topic;
}

/** POST /api/topics/[id]/start: add a shared topic to your topics. */
export const POST = handler(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  await sharedTopicOr404(userId, id);
  const topic = await startTopic(userId, id);
  kickResearchPool('topic started');
  return ok({ topic, mine: true });
});

/** DELETE /api/topics/[id]/start: remove a shared topic from your topics. */
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  await sharedTopicOr404(userId, id);
  const topic = await stopTopic(userId, id);
  kickResearchPool('topic stopped');
  return ok({ topic, mine: false });
});
