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
  /** When set, the provider must return `json` matching this JSON Schema. */
  jsonSchema?: Record<string, unknown>;
  schemaName?: string;
}

export interface ProviderResult {
  /** Raw text (unstructured calls) or the JSON-serialised structured output. */
  text: string;
  /** Parsed structured output when jsonSchema was requested and the provider returned a native object. */
  json?: unknown;
  inputTokens: number;
  outputTokens: number;
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
