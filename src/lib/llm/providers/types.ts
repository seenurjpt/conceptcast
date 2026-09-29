export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ProviderCallArgs {
  apiKey: string;
  model: string;
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  /**
   * When set, the provider must return `json` matching this JSON Schema.
   * Providers that cannot combine native structured output with web search
   * fall back to prompt-driven JSON, which the client parses and validates.
   */
  jsonSchema?: Record<string, unknown>;
  schemaName?: string;
  /** Let the model search the web (Anthropic web_search, OpenAI web_search, Gemini Google Search). */
  webSearch?: { maxUses: number };
}

export interface ProviderResult {
  /** Raw text (unstructured calls) or the JSON-serialised structured output. */
  text: string;
  /** Parsed structured output when jsonSchema was requested and the provider returned a native object. */
  json?: unknown;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  webSearches?: number;
  /** The reply was cut off by maxTokens and can never parse as a whole. */
  truncated?: boolean;
}

export class ProviderAuthError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderAuthError';
  }
}

export type ProviderFn = (args: ProviderCallArgs) => Promise<ProviderResult>;
