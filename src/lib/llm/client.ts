/**
 * Thin provider abstraction. One function, `complete`, that:
 *   - decrypts the user's stored keys (Anthropic, OpenAI, Gemini) and tries
 *     them in order: preferred provider first, then the rest. There is no
 *     deployment-wide key; every call is paid for by the signed-in user,
 *   - maps a tier to a model via lib/llm/models.ts,
 *   - moves on to the next stored key when a provider answers 401,
 *   - re-runs once with double the budget when the reply was truncated,
 *   - requests structured output when a zod schema is passed, validates it,
 *     retries once with the zod error appended, then throws
 *     StructuredOutputError,
 *   - logs every call to `llm_calls`.
 */
import { z } from 'zod';
import { users, llmCalls } from '../db/collections';
import { decryptSecret } from './keys';
import {
  DEFAULT_PROVIDER,
  MAX_OUTPUT_TOKENS,
  PROVIDER_LABELS,
  costUsd,
  modelFor,
  providerOrder,
  type Provider,
  type Tier,
} from './models';
import { callAnthropic } from './providers/anthropic';
import { callGemini } from './providers/gemini';
import { callOpenAI } from './providers/openai';
import { ProviderAuthError, type ChatMessage, type ProviderFn, type ProviderResult } from './providers/types';
import type { UserDoc } from '../schemas/post';

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

export const NO_API_KEY_MESSAGE =
  'No AI API key on your account. Add an Anthropic, OpenAI or Gemini key in Settings to generate anything.';

export class NoApiKeyError extends Error {
  constructor(public readonly userId: string) {
    super(NO_API_KEY_MESSAGE);
    this.name = 'NoApiKeyError';
  }
}

export interface UsageInfo {
  stage: string;
  provider: Provider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  webSearches: number;
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
  /** Let the model search the web. */
  webSearch?: { maxUses: number };
  /** Called after every provider round-trip, including retries. */
  onUsage?: (usage: UsageInfo) => void;
}

export type CompleteResult<S> = S extends z.ZodType ? z.infer<S> : string;

const PROVIDERS_FN: Record<Provider, ProviderFn> = { anthropic: callAnthropic, openai: callOpenAI, gemini: callGemini };

interface ResolvedKey {
  provider: Provider;
  apiKey: string;
}

export function keyBlobFor(llm: UserDoc['llm'] | undefined, provider: Provider) {
  if (!llm) return null;
  return provider === 'anthropic' ? llm.anthropicKey : provider === 'openai' ? llm.openaiKey : llm.geminiKey;
}

/** Every stored key the user has, preferred provider first. Never the environment. */
export async function resolveKeys(userId: string): Promise<ResolvedKey[]> {
  const user = await users.get(userId);
  const preferred: Provider = user?.llm.preferredProvider ?? DEFAULT_PROVIDER;
  const out: ResolvedKey[] = [];
  for (const provider of providerOrder(preferred)) {
    const blob = keyBlobFor(user?.llm, provider);
    if (blob) out.push({ provider, apiKey: decryptSecret(blob) });
  }
  return out;
}

/** Which providers the user can use right now, preferred first. */
export async function availableProviders(userId: string): Promise<Provider[]> {
  return (await resolveKeys(userId)).map((k) => k.provider);
}

function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: 'draft-7', unrepresentable: 'any' }) as Record<string, unknown>;
}

/** Pulls the last fenced JSON block, or falls back to the outermost braces. */
export function extractJson(text: string): string {
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
  if (keys.length === 0) throw new NoApiKeyError(args.userId);

  const jsonSchema = args.schema ? toJsonSchema(args.schema) : undefined;
  const baseMaxTokens = args.maxTokens ?? MAX_OUTPUT_TOKENS[args.tier];

  const tryKey = async (
    key: ResolvedKey,
    messages: ChatMessage[],
    attempt: string,
    maxTokens: number,
  ): Promise<ProviderResult> => {
    const spec = modelFor(key.provider, args.tier);
    const t0 = Date.now();
    let res: ProviderResult | null = null;
    let error: string | null = null;
    try {
      res = await PROVIDERS_FN[key.provider]({
        apiKey: key.apiKey,
        model: spec.id,
        system: args.system,
        messages,
        maxTokens,
        jsonSchema,
        schemaName: stage.replace(/[^a-zA-Z0-9_]/g, '_'),
        webSearch: args.webSearch,
      });
      args.onUsage?.({
        stage: attempt,
        provider: key.provider,
        model: spec.id,
        inputTokens: res.inputTokens,
        outputTokens: res.outputTokens,
        cacheCreationTokens: res.cacheCreationTokens ?? 0,
        cacheReadTokens: res.cacheReadTokens ?? 0,
        webSearches: res.webSearches ?? 0,
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

  /** First key that does not reject us; a 401 moves on to the next stored key. */
  const callWithFallback = async (messages: ChatMessage[], attempt: string): Promise<ProviderResult> => {
    let lastAuth: ProviderAuthError | null = null;
    for (const key of keys) {
      try {
        let res = await tryKey(key, messages, attempt, baseMaxTokens);
        // A reply cut off by max_tokens can never parse; asking the model to
        // "correct" it just truncates again. Re-run once with double the budget.
        if (res.truncated) {
          console.error(`  [${attempt}] hit max tokens (${baseMaxTokens}); retrying with ${baseMaxTokens * 2}`);
          res = await tryKey(key, messages, `${attempt}:untruncate`, baseMaxTokens * 2);
          if (res.truncated) {
            throw new Error(
              `[${attempt}] output truncated at ${baseMaxTokens * 2} tokens twice; raise maxTokens or shorten the requested output.`,
            );
          }
        }
        return res;
      } catch (e) {
        if (e instanceof ProviderAuthError) {
          lastAuth = e;
          console.error(`[llm] ${PROVIDER_LABELS[key.provider]} rejected the key (401); trying the next stored key`);
          continue;
        }
        throw e;
      }
    }
    throw new Error(
      `Every stored AI key was rejected (${lastAuth?.provider ?? 'unknown'}: ${lastAuth?.message ?? ''}). Check your keys in Settings.`,
    );
  };

  const first = await callWithFallback(args.messages, stage);
  if (!args.schema) return first.text as CompleteResult<S>;

  const r1 = parseStructured(args.schema, first);
  if (r1.ok) return r1.value as CompleteResult<S>;

  console.error(`  [${stage}] validation failed, retrying once: ${r1.error.slice(0, 300)}`);
  const retry = await callWithFallback(
    [
      ...args.messages,
      { role: 'assistant', content: first.text || '(empty)' },
      {
        role: 'user',
        content:
          `Your previous output failed validation:\n\n${r1.error}\n\n` +
          `Respond again with ONLY a single corrected JSON object in a \`\`\`json fence. No prose.`,
      },
    ],
    `${stage}:retry`,
  );
  const r2 = parseStructured(args.schema, retry);
  if (r2.ok) return r2.value as CompleteResult<S>;
  throw new StructuredOutputError(stage, r2.error, retry.text);
}

export type LlmComplete = typeof complete;
