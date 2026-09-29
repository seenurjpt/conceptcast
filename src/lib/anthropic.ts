/**
 * The JSON-call entry point the agents use (researcher, writer, critic,
 * selector, voice extraction, topic suggestions, proposals).
 *
 * Historically this spoke to Anthropic directly with a deployment key. It now
 * delegates to lib/llm/client, which pays for every call with a key the
 * signed-in user stored in Settings (Anthropic, OpenAI or Gemini, whichever
 * they added), so nothing here names a provider. The file keeps its name so
 * the call sites and their git history stay put.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { z } from 'zod';
import { currentUserId } from './currentUser';
import { complete, extractJson, type ChatMessage, type UsageInfo } from './llm/client';
import type { Tier } from './llm/models';

export { extractJson };

/** Tiers, not model ids: lib/llm/models.ts decides what each means per provider. */
export const MODELS = {
  /** Research, writing, critique. */
  heavy: 'standard',
  /** Selection and cheap classification. */
  light: 'cheap',
} as const satisfies Record<string, Tier>;

const USAGE_FILE = path.join(process.cwd(), 'data', 'usage.jsonl');

export interface UsageRow {
  at: string;
  stage: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  webSearches: number;
}

/** Optional extra sink (e.g. the Mongo `usage` collection). JSONL always written. */
let usageSink: ((row: UsageRow) => void) | null = null;
export function setUsageSink(fn: (row: UsageRow) => void): void {
  usageSink = fn;
}

function logUsage(u: UsageInfo): void {
  const row: UsageRow = {
    at: new Date().toISOString(),
    stage: u.stage,
    model: u.model,
    inputTokens: u.inputTokens,
    outputTokens: u.outputTokens,
    cacheCreationTokens: u.cacheCreationTokens,
    cacheReadTokens: u.cacheReadTokens,
    webSearches: u.webSearches,
  };
  try {
    fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
    fs.appendFileSync(USAGE_FILE, JSON.stringify(row) + '\n');
  } catch (e) {
    console.error(`  [usage] could not append to ${USAGE_FILE}: ${(e as Error).message}`);
  }
  usageSink?.(row);
  console.error(
    `  [usage] ${u.stage} (${u.provider}/${u.model}): in=${row.inputTokens} out=${row.outputTokens}` +
      ` cacheWrite=${row.cacheCreationTokens} cacheRead=${row.cacheReadTokens}` +
      (row.webSearches ? ` webSearches=${row.webSearches}` : ''),
  );
}

/** A system prompt as one or more text blocks; joined with a blank line. */
export type SystemBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } };

export interface JsonCallOptions<S extends z.ZodType> {
  stage: string;
  /** A tier from MODELS. */
  model: Tier;
  system: SystemBlock[];
  messages: ChatMessage[];
  schema: S;
  maxTokens: number;
  /** Let the model search the web (every provider has a hosted search tool). */
  webSearch?: { maxUses: number };
  /** Defaults to the signed-in author. */
  userId?: string;
}

/**
 * Calls the user's provider expecting JSON that validates against `schema`.
 * On a parse/validation failure the client retries exactly once with the
 * error appended to the conversation, then fails loudly.
 */
export async function callJson<S extends z.ZodType>(opts: JsonCallOptions<S>): Promise<z.infer<S>> {
  return (await complete({
    userId: opts.userId ?? (await currentUserId()),
    tier: opts.model,
    stage: opts.stage,
    system: opts.system.map((b) => b.text).join('\n\n'),
    messages: opts.messages,
    schema: opts.schema,
    maxTokens: opts.maxTokens,
    webSearch: opts.webSearch,
    onUsage: logUsage,
  })) as z.infer<S>;
}
