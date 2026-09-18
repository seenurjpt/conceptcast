/**
 * Thin provider abstraction. One function, `complete`, that:
 *   - resolves the user's provider preference and decrypts their key,
 *   - maps a tier to a model via lib/llm/models.ts,
 *   - falls back to the other provider when the primary answers 401,
 *   - requests structured output when a zod schema is passed, validates it,
 *     retries once with the zod error appended, then throws
 *     StructuredOutputError,
 *   - logs every call to `llm_calls`.
 */
import { z } from 'zod';
import { users, llmCalls } from '../db/collections';
import { decryptSecret } from './keys';
import { DEFAULT_PROVIDER, MAX_OUTPUT_TOKENS, costUsd, modelFor, type Provider, type Tier } from './models';
import { callAnthropic } from './providers/anthropic';
import { callOpenAI } from './providers/openai';
import { ProviderAuthError, type ChatMessage, type ProviderFn, type ProviderResult } from './providers/types';

export type { ChatMessage } from './providers/types';

export class StructuredOutputError extends Error {
  constructor(
    public readonly stage: string,
    public readonly issues: string,
    public readonly raw: string,
  ) {
    super(`[${stage}] structured output failed validation after one retry:\n${issues}`);
    this.name = 'StructuredOutputError';
  }
}

export class NoApiKeyError extends Error {
  constructor(userId: string) {
    super(`No LLM API key configured for user ${userId}. Add one via PUT /api/user/keys.`);
    this.name = 'NoApiKeyError';
  }
}

export interface CompleteArgs<S extends z.ZodType | undefined> {
  userId: string;
  tier: Tier;
  system: string;
  messages: ChatMessage[];
  schema?: S;
  /** Attribution for `llm_calls`. */
  runId?: string | null;
  stage?: string;
  maxTokens?: number;
}

export type CompleteResult<S> = S extends z.ZodType ? z.infer<S> : string;

const PROVIDERS: Record<Provider, ProviderFn> = { anthropic: callAnthropic, openai: callOpenAI };

interface ResolvedKey {
  provider: Provider;
  apiKey: string;
}

/** The user's stored key for a provider, else the deployment's env key (single-tenant convenience). */
async function resolveKeys(userId: string): Promise<{ primary: ResolvedKey | null; fallback: ResolvedKey | null }> {
  const user = await users.get(userId);
  const preferred: Provider = user?.llm.preferredProvider ?? DEFAULT_PROVIDER;
  const other: Provider = preferred === 'anthropic' ? 'openai' : 'anthropic';
  const keyFor = (p: Provider): string | null => {
    const blob = p === 'anthropic' ? user?.llm.anthropicKey : user?.llm.openaiKey;
    if (blob) return decryptSecret(blob);
    const env = p === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
    return env ?? null;
  };
  const pk = keyFor(preferred);
  const ok = keyFor(other);
  return {
    primary: pk ? { provider: preferred, apiKey: pk } : ok ? { provider: other, apiKey: ok } : null,
    fallback: pk && ok ? { provider: other, apiKey: ok } : null,
  };
}

function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: 'draft-7', unrepresentable: 'any' }) as Record<string, unknown>;
}

function extractJson(text: string): string {
  const fences = [...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)\n```/g)];
  if (fences.length > 0) return fences[fences.length - 1][1];
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error(`No JSON object in output (${text.length} chars).`);
  return text.slice(start, end + 1);
}

function parseStructured(
  schema: z.ZodType,
  result: ProviderResult,
): { ok: true; value: unknown } | { ok: false; error: string } {
  let raw: unknown = result.json;
  if (raw === undefined) {
    try {
      raw = JSON.parse(extractJson(result.text));
    } catch (e) {
      return { ok: false, error: `JSON parse error: ${(e as Error).message}` };
    }
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, error: JSON.stringify(parsed.error.issues, null, 2) };
}

export async function complete<S extends z.ZodType | undefined = undefined>(
  args: CompleteArgs<S>,
): Promise<CompleteResult<S>> {
  const stage = args.stage ?? 'unknown';
  const keys = await resolveKeys(args.userId);
  if (!keys.primary) throw new NoApiKeyError(args.userId);

  const jsonSchema = args.schema ? toJsonSchema(args.schema) : undefined;
  const maxTokens = args.maxTokens ?? MAX_OUTPUT_TOKENS[args.tier];

  const tryKey = async (key: ResolvedKey, messages: ChatMessage[], attempt: string): Promise<ProviderResult> => {
    const spec = modelFor(key.provider, args.tier);
    const t0 = Date.now();
    let res: ProviderResult | null = null;
    let error: string | null = null;
    try {
      res = await PROVIDERS[key.provider]({
        apiKey: key.apiKey,
        model: spec.id,
        system: args.system,
        messages,
        maxTokens,
        jsonSchema,
        schemaName: stage.replace(/[^a-zA-Z0-9_]/g, '_'),
      });
      return res;
    } catch (e) {
      error = (e as Error).message;
      throw e;
    } finally {
      await llmCalls
        .insert({
          runId: args.runId ?? null,
          userId: args.userId,
          stage: attempt,
          provider: key.provider,
          model: spec.id,
          inputTokens: res?.inputTokens ?? 0,
          outputTokens: res?.outputTokens ?? 0,
          latencyMs: Date.now() - t0,
          costUsd: res ? costUsd(spec, res.inputTokens, res.outputTokens) : 0,
          ok: res !== null,
          error,
        })
        .catch((e: unknown) => console.error(`[llm_calls] persist failed: ${(e as Error).message}`));
    }
  };

  const callWithFallback = async (messages: ChatMessage[], attempt: string): Promise<ProviderResult> => {
    try {
      return await tryKey(keys.primary as ResolvedKey, messages, attempt);
    } catch (e) {
      if (e instanceof ProviderAuthError && keys.fallback) {
        console.error(`[llm] ${e.provider} rejected the key (401); falling back to ${keys.fallback.provider}`);
        return tryKey(keys.fallback, messages, attempt);
      }
      throw e;
    }
  };

  const first = await callWithFallback(args.messages, stage);
  if (!args.schema) return first.text as CompleteResult<S>;

  const r1 = parseStructured(args.schema, first);
  if (r1.ok) return r1.value as CompleteResult<S>;

  const retry = await callWithFallback(
    [
      ...args.messages,
      { role: 'assistant', content: first.text || '(empty)' },
      {
        role: 'user',
        content: `Your previous output failed validation:\n\n${r1.error}\n\nRespond again with only the corrected structured output.`,
      },
    ],
    `${stage}:retry`,
  );
  const r2 = parseStructured(args.schema, retry);
  if (r2.ok) return r2.value as CompleteResult<S>;
  throw new StructuredOutputError(stage, r2.error, retry.text);
}

export type LlmComplete = typeof complete;
