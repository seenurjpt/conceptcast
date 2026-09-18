import { ProviderAuthError, type ProviderCallArgs, type ProviderResult } from './types';

interface ChatCompletion {
  choices: { message: { content: string | null; refusal?: string | null } }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
}

/** Chat Completions over fetch: no SDK dependency for the secondary provider. */
export async function callOpenAI(args: ProviderCallArgs): Promise<ProviderResult> {
  const base = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
  const body: Record<string, unknown> = {
    model: args.model,
    max_completion_tokens: args.maxTokens,
    messages: [{ role: 'system', content: args.system }, ...args.messages],
  };
  if (args.jsonSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: args.schemaName ?? 'emit', schema: args.jsonSchema, strict: false },
    };
  }
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${args.apiKey}` },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new ProviderAuthError('openai', `OpenAI 401: ${await res.text()}`);
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 500)}`);
  const data = (await res.json()) as ChatCompletion;
  const choice = data.choices[0];
  if (choice?.message.refusal) throw new Error(`OpenAI refusal: ${choice.message.refusal}`);
  const text = choice?.message.content ?? '';
  let json: unknown;
  if (args.jsonSchema) {
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
  }
  return {
    text,
    json,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}
