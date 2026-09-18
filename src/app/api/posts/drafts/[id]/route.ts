import { z } from 'zod';
import { handler, ok, readJson, HttpError, isObjectId } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { angles, postDrafts } from '@/lib/db/collections';
import { assemble } from '@/lib/linkedin/assemble';
import { runRules } from '@/lib/critic/rules';
import { DraftSectionsSchema } from '@/lib/schemas/post';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

async function ownDraft(id: string, userId: string) {
  if (!isObjectId(id)) throw new HttpError(400, 'Bad draft id.');
  const draft = await postDrafts.get(id);
  if (!draft || draft.userId !== userId) throw new HttpError(404, 'Draft not found.');
  return draft;
}

/** GET /api/posts/drafts/[id] */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const draft = await ownDraft(id, userId);
  const angle = draft.angleId ? await angles.get(draft.angleId) : null;
  return ok({ draft, angle });
});

const Patch = z.object({
  sections: DraftSectionsSchema.partial().optional(),
  hashtags: z.array(z.string().min(1).max(60)).max(10).optional(),
});

/**
 * PATCH /api/posts/drafts/[id] { sections?, hashtags? }
 * Merges the edit, re-assembles, and re-runs the deterministic critic only
 * (no LLM). The draft keeps its status; the human is already in the loop.
 */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const draft = await ownDraft(id, userId);
  if (draft.status === 'approved' || draft.status === 'posted') {
    throw new HttpError(409, `Draft is ${draft.status}; it can no longer be edited.`);
  }
  const body = await readJson(req, Patch);
  const sections = { ...draft.sections, ...(body.sections ?? {}) };
  const hashtags = body.hashtags ?? draft.hashtags;
  const { assembled, charCount } = assemble(sections, hashtags);

  const angle = draft.angleId ? await angles.get(draft.angleId) : null;
  const failures = runRules({
    sections,
    hashtags,
    assembled,
    charCount,
    concreteEvidence: angle?.verifiedAnchors ?? angle?.concreteEvidence ?? [],
  });
  const critique = { pass: failures.length === 0, failures, notes: draft.critique?.notes, voiceMatch: draft.critique?.voiceMatch };
  const status = draft.status === 'needs_author_input' && assembled.length > 0 ? 'ready' : draft.status;
  const updated = await postDrafts.update(id, { sections, hashtags, assembled, charCount, critique, status });
  return ok({ draft: updated, angle });
});
