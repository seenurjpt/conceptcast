import { handler, ok, HttpError } from '@/lib/api';
import { Concept, type ConceptDoc } from '@/lib/db/models';
import { researchInBackground } from '@/lib/research/service';

export const dynamic = 'force-dynamic';
/** Research runs after the response, inside this function's time limit. */
export const maxDuration = 300;

type Ctx = { params: Promise<{ slug: string }> };

/**
 * POST /api/concepts/[slug]/research: step one of writing a post.
 *
 * Answers straight away: `ready` when fresh research already exists, or
 * `running` when research has started (or was already going) in the
 * background. Poll GET /api/concepts/[slug] for `researchState` until it is
 * `ready` (then call /write) or `failed` (show the error, allow a retry).
 * The subtopic stays in the backlog throughout.
 */
export const POST = handler(async (_req: Request, ctx: Ctx) => {
  const startedAt = Date.now();
  const { slug } = await ctx.params;
  const concept = await Concept.findOne({ slug }).lean<ConceptDoc>();
  if (!concept) throw new HttpError(404, 'Subtopic not found.');
  if (concept.status !== 'backlog') throw new HttpError(409, `This subtopic is ${concept.status}, not waiting to be written.`);

  const state = await researchInBackground(concept, { requestStartedAt: startedAt });
  return state === 'ready' ? ok({ status: 'ready' }) : ok({ status: 'running' }, 202);
});
