import { z } from 'zod';
import { handler, ok, readJson } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { rephrasePost, REPHRASE_MODES } from '@/lib/compose';
import { CUSTOM_MAX_CHARS } from '@/lib/pipeline/constraints';

export const dynamic = 'force-dynamic';
/** One model call. */
export const maxDuration = 60;

const Body = z
  .object({
    text: z.string().trim().min(20, 'Write a little more first, so AI has something to work with.').max(CUSTOM_MAX_CHARS),
    mode: z.enum(REPHRASE_MODES),
    instruction: z.string().trim().max(300).optional(),
  })
  .refine((b) => b.mode !== 'custom' || Boolean(b.instruction), { message: 'Say what you want changed.' });

/**
 * POST /api/compose/rephrase { text, mode, instruction? } → { text }
 * Edits the composer's text with the author's AI key, in their voice. Nothing
 * is saved: the composer shows the result and keeps the original for undo.
 */
export const POST = handler(async (req: Request) => {
  await requireUserId();
  const { text, mode, instruction } = await readJson(req, Body);
  return ok({ text: await rephrasePost(text, mode, instruction) });
});
