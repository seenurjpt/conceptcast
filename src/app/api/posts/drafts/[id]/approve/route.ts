import { handler, ok, HttpError, isObjectId } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { postDrafts } from '@/lib/db/collections';
import { inngest, POST_EVENTS } from '@/inngest/client';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** Every this-many approved drafts, the voice profile is re-extracted automatically. */
const VOICE_REFRESH_EVERY = 30;

/** POST /api/posts/drafts/[id]/approve → status 'approved'. Draft output ends here (non-goal: posting). */
export const POST = handler(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  if (!isObjectId(id)) throw new HttpError(400, 'Bad draft id.');
  const draft = await postDrafts.get(id);
  if (!draft || draft.userId !== userId) throw new HttpError(404, 'Draft not found.');
  if (draft.status === 'approved' || draft.status === 'posted') return ok({ draft, alreadyApproved: true });
  if (draft.status !== 'ready') throw new HttpError(409, `Draft is ${draft.status}; only ready drafts can be approved.`);
  if (draft.critique && !draft.critique.pass) {
    const hard = draft.critique.failures.filter((f) => f.rule === 'hard_cap');
    if (hard.length) throw new HttpError(409, 'Draft exceeds the 3000-character hard cap; edit it first.');
  }

  const updated = await postDrafts.update(id, { status: 'approved' });
  const approved = await postDrafts.countByStatus(userId, 'approved');
  let voiceRefreshQueued = false;
  if (approved > 0 && approved % VOICE_REFRESH_EVERY === 0) {
    try {
      await inngest.send({ name: POST_EVENTS.voiceExtract, data: { userId } });
      voiceRefreshQueued = true;
    } catch (e) {
      console.error(`voice.extract enqueue failed: ${(e as Error).message}`);
    }
  }
  return ok({ draft: updated, approvedCount: approved, voiceRefreshQueued });
});
