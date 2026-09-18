import { handler, ok, HttpError, isObjectId } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { generationRuns, postDrafts, angles } from '@/lib/db/collections';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ runId: string }> };

/** GET /api/posts/runs/[runId] → run status, plus the draft (and chosen angle) once there is one. */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { runId } = await ctx.params;
  if (!isObjectId(runId)) throw new HttpError(400, 'Bad run id.');
  const run = await generationRuns.get(runId);
  if (!run || run.userId !== userId) throw new HttpError(404, 'Run not found.');

  const draft = ['ready', 'needs_author_input'].includes(run.status) ? await postDrafts.forRun(runId) : null;
  const angle = draft?.angleId ? await angles.get(draft.angleId) : null;
  return ok({ run, draft, angle });
});
