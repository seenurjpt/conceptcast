/**
 * The ONE place model IDs live. Prompt modules never name a model; they ask
 * for a tier and this file decides what that means per provider.
 *
 * Prices are USD per million tokens and only feed the `costUsd` column of
 * `llm_calls`; adjust them when the provider's price list changes.
 */

export type Tier = 'cheap' | 'standard';
export type Provider = 'anthropic' | 'openai';

export interface ModelSpec {
  id: string;
  inputPerMTok: number;
  outputPerMTok: number;
}

export const MODELS: Record<Provider, Record<Tier, ModelSpec>> = {
  anthropic: {
    cheap: { id: 'claude-haiku-4-5-20251001', inputPerMTok: 1, outputPerMTok: 5 },
    standard: { id: 'claude-sonnet-5', inputPerMTok: 3, outputPerMTok: 15 },
  },
  openai: {
    cheap: { id: 'gpt-4o-mini', inputPerMTok: 0.15, outputPerMTok: 0.6 },
    standard: { id: 'gpt-4o', inputPerMTok: 2.5, outputPerMTok: 10 },
  },
};

export const DEFAULT_PROVIDER: Provider = 'anthropic';

export const MAX_OUTPUT_TOKENS: Record<Tier, number> = {
  cheap: 4_000,
  standard: 8_000,
};

export function modelFor(provider: Provider, tier: Tier): ModelSpec {
  return MODELS[provider][tier];
}

export function costUsd(spec: ModelSpec, inputTokens: number, outputTokens: number): number {
  return (inputTokens * spec.inputPerMTok + outputTokens * spec.outputPerMTok) / 1_000_000;
}
