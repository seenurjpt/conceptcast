import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import type {
  MessageCreateParamsNonStreaming,
  MessageParam,
  Message,
  TextBlockParam,
} from '@anthropic-ai/sdk/resources/messages/messages';
import type { z } from 'zod';

export const MODELS = {
  /** Research, writing, critique. */
  heavy: 'claude-sonnet-5',
  /** Selection and cheap classification. */
  light: 'claude-haiku-4-5-20251001',
} as const;

let _client: Anthropic | null = null;
export function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set. Add it to .env.local.');
    }
    // SDK retries 429/5xx with exponential backoff + jitter and honours retry-after.
    _client = new Anthropic({ maxRetries: 5 });
  }
  return _client;
}

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

function logUsage(stage: string, model: string, message: Message): void {
  const u = message.usage;
  const row: UsageRow = {
    at: new Date().toISOString(),
    stage,
    model,
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    webSearches: u.server_tool_use?.web_search_requests ?? 0,
  };
  fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
  fs.appendFileSync(USAGE_FILE, JSON.stringify(row) + '\n');
  usageSink?.(row);
  console.error(
    `  [usage] ${stage}: in=${row.inputTokens} out=${row.outputTokens}` +
      ` cacheWrite=${row.cacheCreationTokens} cacheRead=${row.cacheReadTokens}` +
      (row.webSearches ? ` webSearches=${row.webSearches}` : ''),
  );
}

export function extractText(message: Message): string {
  return message.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

/** Pulls the last fenced JSON block, or falls back to the outermost braces. */
export function extractJson(text: string): string {
  const fences = [...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)\n```/g)];
  if (fences.length > 0) return fences[fences.length - 1][1];
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error(`No JSON object found in model output (${text.length} chars).`);
  }
  return text.slice(start, end + 1);
}

export interface JsonCallOptions<S extends z.ZodType> {
  stage: string;
  model: string;
  system: TextBlockParam[];
  messages: MessageParam[];
  schema: S;
  maxTokens: number;
  tools?: MessageCreateParamsNonStreaming['tools'];
}

/**
 * Calls the API expecting JSON that validates against `schema`.
 * On a parse/validation failure, retries exactly once with the error
 * appended to the conversation, then fails loudly.
 */
export async function callJson<S extends z.ZodType>(
  opts: JsonCallOptions<S>,
): Promise<z.infer<S>> {
  const client = getClient();
  const params: MessageCreateParamsNonStreaming = {
    model: opts.model,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: opts.messages,
    ...(opts.tools ? { tools: opts.tools } : {}),
  };

  const first = await client.messages.create(params);
  logUsage(opts.stage, opts.model, first);
  const firstText = extractText(first);

  const attempt = (text: string): { ok: true; value: z.infer<S> } | { ok: false; error: string } => {
    let raw: unknown;
    try {
      raw = JSON.parse(extractJson(text));
    } catch (e) {
      return { ok: false, error: `JSON parse error: ${(e as Error).message}` };
    }
    const parsed = opts.schema.safeParse(raw);
    if (parsed.success) return { ok: true, value: parsed.data };
    return { ok: false, error: JSON.stringify(parsed.error.issues, null, 2) };
  };

  const r1 = attempt(firstText);
  if (r1.ok) return r1.value;

  console.error(`  [${opts.stage}] validation failed, retrying once: ${r1.error.slice(0, 300)}`);
  const retry = await client.messages.create({
    ...params,
    messages: [
      ...opts.messages,
      { role: 'assistant', content: firstText || '(empty)' },
      {
        role: 'user',
        content:
          `Your previous output failed validation:\n\n${r1.error}\n\n` +
          `Respond again with ONLY a single corrected JSON object in a \`\`\`json fence. No prose.`,
      },
    ],
  });
  logUsage(`${opts.stage}-retry`, opts.model, retry);
  const r2 = attempt(extractText(retry));
  if (r2.ok) return r2.value;

  throw new Error(`[${opts.stage}] output failed validation after one retry:\n${r2.error}`);
}
