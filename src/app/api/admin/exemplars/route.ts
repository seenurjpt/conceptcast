import { z } from 'zod';
import { handler, ok, readJson, HttpError } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { archetypes, exemplars } from '@/lib/db/collections';
import { hookLength } from '@/lib/linkedin/charCount';
import { ArchetypeSlugSchema, ExemplarAnnotationsSchema } from '@/lib/schemas/post';
import { MIN_EXEMPLARS } from '@/lib/pipeline/postPipeline';

export const dynamic = 'force-dynamic';

/** GET /api/admin/exemplars → archetypes with their exemplar counts, and every exemplar. */
export const GET = handler(async () => {
  await requireUserId();
  const [list, counts, all] = await Promise.all([archetypes.list(), exemplars.countByArchetype(), exemplars.list()]);
  return ok({
    minPerArchetype: MIN_EXEMPLARS,
    archetypes: list.map((a) => ({
      slug: a.slug,
      name: a.name,
      description: a.description,
      slots: a.structure.map((s) => s.slot),
      requiresFirsthandEvidence: a.requiresFirsthandEvidence,
      count: counts[a.slug] ?? 0,
    })),
    exemplars: all,
  });
});

const Body = z.object({
  archetypeSlug: ArchetypeSlugSchema,
  authorHandle: z.string().trim().min(1).max(100),
  rawText: z.string().trim().min(50).max(6_000),
  annotations: ExemplarAnnotationsSchema,
});

/** POST /api/admin/exemplars { archetypeSlug, authorHandle, rawText, annotations } */
export const POST = handler(async (req: Request) => {
  const userId = await requireUserId();
  const body = await readJson(req, Body);
  const archetype = await archetypes.get(body.archetypeSlug);
  if (!archetype) throw new HttpError(400, `Archetype ${body.archetypeSlug} is not seeded; run npm run seed:archetypes.`);
  const doc = await exemplars.insert({
    archetypeSlug: body.archetypeSlug,
    authorHandle: body.authorHandle,
    rawText: body.rawText,
    charCount: hookLength(body.rawText),
    annotations: body.annotations,
    addedBy: userId,
  });
  const counts = await exemplars.countByArchetype();
  return ok({ exemplar: doc, count: counts[body.archetypeSlug] ?? 0 }, 201);
});
