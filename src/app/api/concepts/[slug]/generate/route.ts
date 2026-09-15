import { z } from 'zod';
import { handler, ok, readJson, HttpError, pipelineMode } from '@/lib/api';
import { Concept, type ConceptDoc } from '@/lib/db/models';
import { generateForConcept } from '@/lib/pipeline/generate';
import { AngleSchema } from '@/lib/schemas';
import { inngest, EVENTS } from '@/inngest/client';

export const dynamic = 'force-dynamic';
/** The inline pipeline takes a few minutes (research with web search). */
export const maxDuration = 600;

type Ctx = { params: Promise<{ slug: string }> };

const Body = z.object({
  angle: AngleSchema.optional(),
  force: z.boolean().default(false),
});

/** POST /api/concepts/[slug]/generate — force-run the pipeline now. */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const body = await readJson(req, Body);
  const concept = await Concept.findOne({ slug }).lean<ConceptDoc>();
  if (!concept) throw new HttpError(404, 'Concept not found.');
  if (concept.status === 'retired') throw new HttpError(409, 'Concept is retired.');
  if (concept.status !== 'backlog' && !body.force) {
    throw new HttpError(409, `Concept is ${concept.status}; pass force:true to regenerate anyway.`);
  }

  if (pipelineMode() === 'inngest') {
    await inngest.send({
      name: EVENTS.generateRequested,
      data: { conceptId: String(concept._id), angle: body.angle, force: body.force },
    });
    return ok({ queued: true, slug }, 202);
  }

  const log: string[] = [];
  const result = await generateForConcept(slug, {
    angles: body.angle ? [body.angle] : undefined,
    force: body.force,
    log: (m) => log.push(m),
  });
  return ok({ queued: false, result, log });
});
