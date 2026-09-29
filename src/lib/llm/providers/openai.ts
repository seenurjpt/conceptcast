import { ProviderAuthError, type ProviderCallArgs, type ProviderResult } from './types';

interface ResponsesReply {
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output?: {
    type: string;
    content?: { type: string; text?: string; refusal?: string }[];
  }[];
  usage?: { input_tokens: number; output_tokens: number };
}

/**
 * The Responses API over fetch: no SDK dependency for a secondary provider.
 * Structured output is native (`text.format` json_schema); web search is the
 * hosted `web_search` tool. Together they are allowed, but the schema is left
 * off when searching so a long research reply is not forced into strict mode.
 */
export async function callOpenAI(args: ProviderCallArgs): Promise<ProviderResult> {
  const base = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
  const body: Record<string, unknown> = {
    model: args.model,
    instructions: args.system,
    input: args.messages.map((m) => ({ role: m.role, content: m.content })),
    max_output_tokens: args.maxTokens,
  };
  if (args.webSearch) body.tools = [{ type: 'web_search' }];
  if (args.jsonSchema && !args.webSearch) {
    body.text = {
      format: { type: 'json_schema', name: args.schemaName ?? 'emit', schema: args.jsonSchema, strict: false },
    };
  }
  const res = await fetch(`${base}/responses`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${args.apiKey}` },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new ProviderAuthError('openai', `OpenAI 401: ${await res.text()}`);
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 500)}`);
  const data = (await res.json()) as ResponsesReply;
  const parts = (data.output ?? []).filter((o) => o.type === 'message').flatMap((o) => o.content ?? []);
  const refusal = parts.find((p) => p.type === 'refusal')?.refusal;
  if (refusal) throw new Error(`OpenAI refusal: ${refusal}`);
  const text = parts
    .filter((p) => p.type === 'output_text')
    .map((p) => p.text ?? '')
    .join('\n');
  let json: unknown;
  if (args.jsonSchema && !args.webSearch) {
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
  }
  return {
    text,
    json,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    truncated: data.status === 'incomplete' && data.incomplete_details?.reason === 'max_output_tokens',
  };
}
