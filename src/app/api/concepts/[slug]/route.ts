import { z } from 'zod';
import { handler, ok, readJson, HttpError } from '@/lib/api';
import { Concept, Draft, Research, type ConceptDoc, type DraftDoc, type ResearchDoc } from '@/lib/db/models';
import { validateDag } from '@/lib/concepts/dag';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ slug: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const concept = await Concept.findOne({ slug }).lean<ConceptDoc>();
  if (!concept) throw new HttpError(404, 'Concept not found.');
  const [drafts, research] = await Promise.all([
    Draft.find({ conceptId: concept._id }).sort({ createdAt: -1 }).lean<DraftDoc[]>(),
    Research.find({ conceptId: concept._id }).sort({ fetchedAt: -1 }).limit(1).lean<ResearchDoc[]>(),
  ]);
  return ok({ concept, drafts, research: research[0] ?? null });
});

const Patch = z.object({
  devRelevance: z.number().min(0).max(10).optional(),
  timelinessBoost: z.number().min(0).max(10).optional(),
  status: z.enum(['backlog', 'retired']).optional(),
  note: z.string().max(1000).nullable().optional(),
  focus: z.string().min(5).optional(),
  oneLiner: z.string().min(5).optional(),
  prerequisites: z.array(z.string()).optional(),
  primarySources: z
    .array(z.object({ type: z.enum(['paper', 'docs', 'repo', 'blog']), url: z.url(), title: z.string().min(1) }))
    .optional(),
});

/** PATCH /api/concepts/[slug] — relevance, retire/unretire, note, sources, prerequisites. */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const body = await readJson(req, Patch);
  const existing = await Concept.findOne({ slug }).lean<ConceptDoc>();
  if (!existing) throw new HttpError(404, 'Concept not found.');

  if (body.status && existing.status !== 'backlog' && existing.status !== 'retired') {
    throw new HttpError(409, `Cannot change status of a ${existing.status} concept here.`);
  }
  if (body.prerequisites) {
    const all = await Concept.find({}, { slug: 1, prerequisites: 1 }).lean<Pick<ConceptDoc, 'slug' | 'prerequisites'>[]>();
    try {
      validateDag(all.map((c) => (c.slug === slug ? { slug, prerequisites: body.prerequisites as string[] } : c)));
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
  }
  const concept = await Concept.findOneAndUpdate({ slug }, { $set: body }, { new: true }).lean<ConceptDoc>();
  return ok({ concept });
});

/** DELETE /api/concepts/[slug] — retire (soft delete). */
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const concept = await Concept.findOneAndUpdate(
    { slug, status: { $in: ['backlog', 'retired'] } },
    { $set: { status: 'retired' } },
    { new: true },
  ).lean<ConceptDoc>();
  if (!concept) throw new HttpError(404, 'Concept not found or not retirable.');
  return ok({ concept });
});
