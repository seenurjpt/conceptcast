import { z } from 'zod';
import { handler, ok, readJson } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { users } from '@/lib/db/collections';
import { decryptSecret, encryptSecret, keyHint } from '@/lib/llm/keys';
import { ProviderSchema, type UserDoc } from '@/lib/schemas/post';

export const dynamic = 'force-dynamic';

function summary(user: UserDoc | null) {
  const hint = (blob: UserDoc['llm']['anthropicKey']) => (blob ? keyHint(decryptSecret(blob)) : null);
  return {
    preferredProvider: user?.llm.preferredProvider ?? 'anthropic',
    anthropic: { stored: Boolean(user?.llm.anthropicKey), hint: hint(user?.llm.anthropicKey ?? null), envFallback: Boolean(process.env.ANTHROPIC_API_KEY) },
    openai: { stored: Boolean(user?.llm.openaiKey), hint: hint(user?.llm.openaiKey ?? null), envFallback: Boolean(process.env.OPENAI_API_KEY) },
  };
}

/** GET /api/user/keys → which BYO keys are stored (never the keys themselves). */
export const GET = handler(async () => {
  const userId = await requireUserId();
  return ok(summary(await users.get(userId)));
});

const Body = z.object({
  preferredProvider: ProviderSchema.optional(),
  /** A new key, or null to remove the stored one. Omit to leave unchanged. */
  anthropicKey: z.string().trim().min(10).nullable().optional(),
  openaiKey: z.string().trim().min(10).nullable().optional(),
});

/** PUT /api/user/keys { preferredProvider?, anthropicKey?, openaiKey? } — keys are encrypted at rest. */
export const PUT = handler(async (req: Request) => {
  const userId = await requireUserId();
  const body = await readJson(req, Body);
  const patch: Partial<UserDoc['llm']> = {};
  if (body.preferredProvider) patch.preferredProvider = body.preferredProvider;
  if (body.anthropicKey !== undefined) patch.anthropicKey = body.anthropicKey ? encryptSecret(body.anthropicKey) : null;
  if (body.openaiKey !== undefined) patch.openaiKey = body.openaiKey ? encryptSecret(body.openaiKey) : null;
  await users.setLlm(userId, patch);
  return ok(summary(await users.get(userId)));
});
