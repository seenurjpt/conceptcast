import { handler, ok, HttpError, isObjectId } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { getTopic, suggestAndAddSubtopics } from '@/lib/topics/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/topics/[id]/suggest → { added, proposed }, one cheap model call. */
export const POST = handler(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  if (!isObjectId(id)) throw new HttpError(400, 'Bad id.');
  const topic = await getTopic(userId, id);
  if (!topic) throw new HttpError(404, 'Topic not found.');
  const { added, proposed } = await suggestAndAddSubtopics(topic);
  return ok({ added, proposed, skipped: proposed - added.length });
});
