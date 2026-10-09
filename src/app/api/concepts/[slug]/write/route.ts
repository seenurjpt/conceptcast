import { z } from 'zod';
import { handler, ok, readJson } from '@/lib/api';
import { writePost } from '@/lib/pipeline/generate';
import { kickResearchPool } from '@/lib/research/service';
import { AngleSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';
/** Drafting from finished research: about a minute, two with a revision. */
export const maxDuration = 300;

type Ctx = { params: Promise<{ slug: string }> };

const Body = z.object({ angle: AngleSchema.optional() });

/**
 * POST /api/concepts/[slug]/write { angle? }: step two, after research.
 *
 * All or nothing (see writePost): the result is either a saved draft with
 * the subtopic moved on, or the subtopic exactly as it was. 409 when the
 * research is not ready or another Write holds the subtopic.
 */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const startedAt = Date.now();
  const { slug } = await ctx.params;
  const body = await readJson(req, Body);
  const log: string[] = [];
  const result = await writePost(slug, { angles: body.angle ? [body.angle] : undefined, log: (m) => log.push(m) });
  // One subtopic left the backlog, so the research pool can refill after the response.
  if (result.status === 'pass') kickResearchPool('write finished', { requestStartedAt: startedAt });
  return ok({ result, log });
});
