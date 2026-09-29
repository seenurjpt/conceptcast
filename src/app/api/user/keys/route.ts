import { z } from 'zod';
import { handler, ok, readJson, HttpError } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { users } from '@/lib/db/collections';
import { decryptSecret, encryptSecret, keyHint } from '@/lib/llm/keys';
import { keyBlobFor } from '@/lib/llm/client';
import { PROVIDERS, PROVIDER_LABELS, providerOrder, type Provider } from '@/lib/llm/models';
import { verifyKey } from '@/lib/llm/providers/verify';
import { ProviderSchema, type UserDoc } from '@/lib/schemas/post';

export const dynamic = 'force-dynamic';

export interface KeySummary {
  preferredProvider: Provider;
  /** Stored providers in the order calls will try them. */
  active: Provider[];
  providers: Record<Provider, { label: string; stored: boolean; hint: string | null }>;
}

function summary(user: UserDoc | null): KeySummary {
  const preferred = user?.llm.preferredProvider ?? 'anthropic';
  const providers = Object.fromEntries(
    PROVIDERS.map((p) => {
      const blob = keyBlobFor(user?.llm, p);
      return [p, { label: PROVIDER_LABELS[p], stored: Boolean(blob), hint: blob ? keyHint(decryptSecret(blob)) : null }];
    }),
  ) as KeySummary['providers'];
  return {
    preferredProvider: preferred,
    active: providerOrder(preferred).filter((p) => providers[p].stored),
    providers,
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
  geminiKey: z.string().trim().min(10).nullable().optional(),
});

const FIELD: Record<Provider, 'anthropicKey' | 'openaiKey' | 'geminiKey'> = {
  anthropic: 'anthropicKey',
  openai: 'openaiKey',
  gemini: 'geminiKey',
};

/**
 * PUT /api/user/keys { preferredProvider?, anthropicKey?, openaiKey?, geminiKey? }
 * A new key is checked against the provider before it is stored, then
 * encrypted at rest. null removes a key.
 */
export const PUT = handler(async (req: Request) => {
  const userId = await requireUserId();
  const body = await readJson(req, Body);
  const patch: Partial<UserDoc['llm']> = {};
  if (body.preferredProvider) patch.preferredProvider = body.preferredProvider;
  for (const provider of PROVIDERS) {
    const value = body[FIELD[provider]];
    if (value === undefined) continue;
    if (value === null) {
      patch[FIELD[provider]] = null;
      continue;
    }
    const check = await verifyKey(provider, value);
    if (!check.ok) throw new HttpError(400, `${PROVIDER_LABELS[provider]}: ${check.reason}`);
    patch[FIELD[provider]] = encryptSecret(value);
  }
  await users.setLlm(userId, patch);
  return ok(summary(await users.get(userId)));
});
