import { z } from 'zod';
import { handler, ok, readJson, HttpError } from '@/lib/api';
import { Concept, type ConceptDoc } from '@/lib/db/models';
import { validateDag } from '@/lib/concepts/dag';
import { releaseStaleClaims } from '@/lib/pipeline/generate';

export const dynamic = 'force-dynamic';

/** GET /api/concepts?status=backlog&track=production */
export const GET = handler(async (req: Request) => {
  // Put back anything an interrupted run left claimed, so it is visible again.
  await releaseStaleClaims();
  const url = new URL(req.url);
  const filter: Record<string, unknown> = {};
  const status = url.searchParams.get('status');
  const track = url.searchParams.get('track');
  if (status) filter.status = status;
  if (track) filter.track = track;
  const topicId = url.searchParams.get('topicId');
  if (topicId) filter.topicId = topicId;
  const concepts = await Concept.find(filter).sort({ track: 1, devRelevance: -1, slug: 1 }).lean<ConceptDoc[]>();
  return ok({ concepts });
});

const NewConcept = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'kebab-case only'),
  title: z.string().min(3),
  track: z.string().min(1).default('custom'),
  topicId: z.string().regex(/^[0-9a-f]{24}$/i).optional(),
  oneLiner: z.string().default(''),
  focus: z.string().default(''),
  prerequisites: z.array(z.string()).default([]),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  devRelevance: z.number().min(0).max(10).default(5),
  primarySources: z
    .array(z.object({ type: z.enum(['paper', 'docs', 'repo', 'blog']), url: z.url(), title: z.string().min(1) }))
    .default([]),
});

/** POST /api/concepts — add to the backlog (DAG re-validated). */
export const POST = handler(async (req: Request) => {
  const body = await readJson(req, NewConcept);
  if (await Concept.exists({ slug: body.slug })) throw new HttpError(409, `Concept "${body.slug}" already exists.`);
  const all = await Concept.find({}, { slug: 1, prerequisites: 1 }).lean<Pick<ConceptDoc, 'slug' | 'prerequisites'>[]>();
  try {
    validateDag([...all, { slug: body.slug, prerequisites: body.prerequisites }]);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
  const concept = await Concept.create({ ...body, status: 'backlog', origin: 'user' });
  return ok({ concept }, 201);
});
