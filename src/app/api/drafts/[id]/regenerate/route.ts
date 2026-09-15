import { z } from 'zod';
import { handler, ok, readJson, HttpError, isObjectId } from '@/lib/api';
import { regenerateDraft } from '@/lib/pipeline/generate';
import { AngleSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ angle: AngleSchema.optional() });

/** POST /api/drafts/[id]/regenerate { angle? } — rewrite from the existing research. */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (!isObjectId(id)) throw new HttpError(400, 'Bad id.');
  const body = await readJson(req, Body);
  const log: string[] = [];
  const result = await regenerateDraft(id, { angle: body.angle, log: (m) => log.push(m) });
  return ok({ result, log });
});
