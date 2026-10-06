import { z } from 'zod';
import { handler, ok, readJson } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { createCustomDraft } from '@/lib/compose';
import { CUSTOM_MAX_CHARS } from '@/lib/pipeline/constraints';

export const dynamic = 'force-dynamic';

const Body = z.object({
  body: z.string().trim().min(1, 'Write something first.').max(CUSTOM_MAX_CHARS, `LinkedIn allows ${CUSTOM_MAX_CHARS} characters.`),
});

/**
 * POST /api/compose { body } → { draftId }
 * Saves a post the author wrote as a pending draft. "Save draft" stops here;
 * publish and schedule follow with POST /api/drafts/[id]/approve, so a failed
 * publish still leaves the post safe in Drafts.
 */
export const POST = handler(async (req: Request) => {
  await requireUserId();
  const { body } = await readJson(req, Body);
  const draft = await createCustomDraft(body);
  return ok({ draftId: String(draft._id) }, 201);
});
