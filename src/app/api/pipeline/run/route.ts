import { z } from 'zod';
import { handler, ok, readJson, pipelineMode } from '@/lib/api';
import { selectNextConcept } from '@/lib/agents/selector';
import { generateForConcept } from '@/lib/pipeline/generate';
import { inngest, EVENTS } from '@/inngest/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

const Body = z.object({
  /** Only run the selector and report the ranking; generate nothing. */
  dryRun: z.boolean().default(false),
});

/** POST /api/pipeline/run — what the Mon/Thu cron does, on demand. */
export const POST = handler(async (req: Request) => {
  const { dryRun } = await readJson(req, Body);
  const selection = await selectNextConcept();
  const summary = {
    eligible: selection.eligible,
    ranked: selection.ranked.map((r) => ({
      slug: r.slug,
      title: r.title,
      track: r.track,
      total: Math.round(r.total * 10) / 10,
      teachability: r.teachability,
      surprise: r.surprise,
      applicability: r.applicability,
      reasoning: r.reasoning,
    })),
    chosen: selection.chosen?.slug ?? null,
  };
  if (dryRun || !selection.chosen) return ok({ ...summary, generated: null });

  if (pipelineMode() === 'inngest') {
    await inngest.send({ name: EVENTS.generateRequested, data: { conceptId: String(selection.chosen._id) } });
    return ok({ ...summary, queued: true }, 202);
  }
  const log: string[] = [];
  const result = await generateForConcept(selection.chosen.slug, { log: (m) => log.push(m) });
  return ok({ ...summary, generated: result, log });
});
