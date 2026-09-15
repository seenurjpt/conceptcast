import { z } from 'zod';
import { handler, ok, readJson, HttpError } from '@/lib/api';
import { Concept, type ConceptDoc } from '@/lib/db/models';
import { TRACKS } from '@/lib/concepts/seed';
import { validateDag } from '@/lib/concepts/dag';

export const dynamic = 'force-dynamic';

/** GET /api/concepts?status=backlog&track=production */
export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const filter: Record<string, unknown> = {};
  const status = url.searchParams.get('status');
  const track = url.searchParams.get('track');
  if (status) filter.status = status;
  if (track) filter.track = track;
  const concepts = await Concept.find(filter).sort({ track: 1, devRelevance: -1, slug: 1 }).lean<ConceptDoc[]>();
  return ok({ concepts });
});

const NewConcept = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'kebab-case only'),
  title: z.string().min(3),
  track: z.enum(TRACKS),
  oneLiner: z.string().min(5),
  focus: z.string().min(5),
  prerequisites: z.array(z.string()).default([]),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
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
  const concept = await Concept.create({ ...body, status: 'backlog' });
  return ok({ concept }, 201);
});
