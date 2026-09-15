import { z } from 'zod';
import { handler, ok, readJson, HttpError, isObjectId } from '@/lib/api';
import { acceptProposal, rejectProposal } from '@/lib/concepts/proposals';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ action: z.enum(['accept', 'reject']) });

/** POST /api/proposals/[id] { action: 'accept' | 'reject' } */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (!isObjectId(id)) throw new HttpError(400, 'Bad id.');
  const { action } = await readJson(req, Body);
  if (action === 'accept') {
    try {
      const concept = await acceptProposal(id);
      return ok({ concept }, 201);
    } catch (e) {
      throw new HttpError(409, (e as Error).message);
    }
  }
  await rejectProposal(id);
  return ok({ rejected: true });
});
