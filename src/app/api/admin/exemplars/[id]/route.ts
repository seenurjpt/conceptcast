import { handler, ok, HttpError, isObjectId } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { exemplars } from '@/lib/db/collections';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /api/admin/exemplars/[id] */
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  await requireUserId();
  const { id } = await ctx.params;
  if (!isObjectId(id)) throw new HttpError(400, 'Bad exemplar id.');
  const removed = await exemplars.remove(id);
  if (!removed) throw new HttpError(404, 'Exemplar not found.');
  return ok({ removed: true });
});
