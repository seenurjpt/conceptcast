import { ProviderAuthError, type ProviderCallArgs, type ProviderResult } from './types';

interface GenerateContentReply {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
    groundingMetadata?: { webSearchQueries?: string[] };
  }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  promptFeedback?: { blockReason?: string };
}

export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * generateContent over fetch. JSON mode (`responseMimeType`) makes the reply
 * a bare object; Gemini does not allow it together with Google Search
 * grounding, so research calls rely on prompt-driven JSON instead.
 */
export async function callGemini(args: ProviderCallArgs): Promise<ProviderResult> {
  const base = process.env.GEMINI_BASE_URL ?? GEMINI_BASE;
  const generationConfig: Record<string, unknown> = { maxOutputTokens: args.maxTokens };
  const jsonMode = Boolean(args.jsonSchema) && !args.webSearch;
  if (jsonMode) generationConfig.responseMimeType = 'application/json';
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: args.system }] },
    contents: args.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    generationConfig,
  };
  if (args.webSearch) body.tools = [{ google_search: {} }];

  const res = await fetch(`${base}/models/${args.model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': args.apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 500);
    if (res.status === 401 || res.status === 403 || (res.status === 400 && /api key/i.test(detail))) {
      throw new ProviderAuthError('gemini', `Gemini ${res.status}: ${detail}`);
    }
    throw new Error(`Gemini ${res.status}: ${detail}`);
  }
  const data = (await res.json()) as GenerateContentReply;
  if (data.promptFeedback?.blockReason) throw new Error(`Gemini blocked the prompt: ${data.promptFeedback.blockReason}`);
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('\n');
  let json: unknown;
  if (jsonMode) {
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
  }
  const usage = data.usageMetadata;
  return {
    text,
    json,
    inputTokens: usage?.promptTokenCount ?? 0,
    // Thinking tokens are billed as output.
    outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
    webSearches: candidate?.groundingMetadata?.webSearchQueries?.length ?? 0,
    truncated: candidate?.finishReason === 'MAX_TOKENS',
  };
}
