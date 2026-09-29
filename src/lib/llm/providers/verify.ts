import type { Provider } from '../models';
import { GEMINI_BASE } from './gemini';

/**
 * Checks a key against the provider's model-list endpoint before it is
 * stored. No tokens are spent; a wrong key fails here instead of on the first
 * three-minute research run.
 */
export async function verifyKey(provider: Provider, apiKey: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const req: { url: string; headers: Record<string, string> } =
    provider === 'anthropic'
      ? { url: 'https://api.anthropic.com/v1/models?limit=1', headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } }
      : provider === 'openai'
        ? { url: `${process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'}/models`, headers: { authorization: `Bearer ${apiKey}` } }
        : { url: `${process.env.GEMINI_BASE_URL ?? GEMINI_BASE}/models?pageSize=1`, headers: { 'x-goog-api-key': apiKey } };
  let res: Response;
  try {
    res = await fetch(req.url, { headers: req.headers, signal: AbortSignal.timeout(15_000) });
  } catch (e) {
    return { ok: false, reason: `Could not reach ${provider}: ${(e as Error).message}` };
  }
  if (res.ok) return { ok: true };
  if (res.status === 401 || res.status === 403) return { ok: false, reason: 'The provider rejected this key.' };
  if (res.status === 400 && provider === 'gemini') return { ok: false, reason: 'The provider rejected this key.' };
  return { ok: false, reason: `${provider} answered ${res.status}; try again in a moment.` };
}
