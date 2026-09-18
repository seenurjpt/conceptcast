import { handler, ok, HttpError } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { postDrafts } from '@/lib/db/collections';
import { DRAFT_STATUSES, type PostDraftStatus } from '@/lib/schemas/post';

export const dynamic = 'force-dynamic';

/** GET /api/posts/drafts?status=ready&page=1&limit=20 → paginated drafts for the signed-in user. */
export const GET = handler(async (req: Request) => {
  const userId = await requireUserId();
  const q = new URL(req.url).searchParams;
  const status = q.get('status') ?? undefined;
  if (status && !(DRAFT_STATUSES as readonly string[]).includes(status)) {
    throw new HttpError(400, `status must be one of ${DRAFT_STATUSES.join(', ')}.`);
  }
  const page = Math.max(1, Number(q.get('page') ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.get('limit') ?? 20) || 20));
  const { items, total } = await postDrafts.page(userId, { status: status as PostDraftStatus | undefined, page, limit });
  return ok({ drafts: items, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
});
