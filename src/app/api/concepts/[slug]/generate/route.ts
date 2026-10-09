import { z } from 'zod';
import { handler, ok, readJson, HttpError, pipelineMode } from '@/lib/api';
import { Concept, type ConceptDoc } from '@/lib/db/models';
import { generateForConcept, writePost } from '@/lib/pipeline/generate';
import { AngleSchema } from '@/lib/schemas';
import { inngest, EVENTS } from '@/inngest/client';
import { kickResearchPool, researchInBackground } from '@/lib/research/service';

export const dynamic = 'force-dynamic';
/** Vercel caps a function at 300 s. Research with web search alone can take
 *  four minutes, so inline mode never researches and drafts in one request:
 *  research runs after the response (the page polls for it), and drafting
 *  runs in a second request from the finished research. */
export const maxDuration = 300;

type Ctx = { params: Promise<{ slug: string }> };

const Body = z.object({
  angle: AngleSchema.optional(),
  force: z.boolean().default(false),
});

/** POST /api/concepts/[slug]/generate: force-run the pipeline now. */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const startedAt = Date.now();
  const { slug } = await ctx.params;
  const body = await readJson(req, Body);
  const concept = await Concept.findOne({ slug }).lean<ConceptDoc>();
  if (!concept) throw new HttpError(404, 'Concept not found.');
  if (concept.status === 'retired') throw new HttpError(409, 'Concept is retired.');
  if (concept.status !== 'backlog' && !body.force) {
    throw new HttpError(409, `Concept is ${concept.status}; pass force:true to regenerate anyway.`);
  }
  if (pipelineMode() === 'inngest') {
    kickResearchPool('write started', { requestStartedAt: startedAt });
    await inngest.send({
      name: EVENTS.generateRequested,
      data: { conceptId: String(concept._id), angle: body.angle, force: body.force },
    });
    return ok({ queued: true, slug }, 202);
  }

  // A subtopic waiting to be written goes through the same two steps as
  // POST /research and POST /write: research in the background (the page
  // polls), then an all-or-nothing write from the finished research.
  if (concept.status === 'backlog') {
    const research = await researchInBackground(concept, { requestStartedAt: startedAt });
    if (research !== 'ready') {
      return ok({ queued: false, researching: true, state: research, slug }, 202);
    }
    const log: string[] = [];
    const result = await writePost(slug, { angles: body.angle ? [body.angle] : undefined, log: (m) => log.push(m) });
    if (result.status === 'pass') kickResearchPool('write finished', { requestStartedAt: startedAt });
    return ok({ queued: false, result, log });
  }

  // Forced rewrite of a subtopic already in flight: research exists, so this
  // only drafts again.
  kickResearchPool('write started', { requestStartedAt: startedAt });
  const log: string[] = [];
  const result = await generateForConcept(slug, {
    angles: body.angle ? [body.angle] : undefined,
    force: body.force,
    log: (m) => log.push(m),
  });
  return ok({ queued: false, result, log });
});
