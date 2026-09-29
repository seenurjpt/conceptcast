import Anthropic from '@anthropic-ai/sdk';
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages/messages';
import { ProviderAuthError, type ProviderCallArgs, type ProviderResult } from './types';

/**
 * Structured output via forced tool use: the schema becomes the tool's
 * input_schema and the model must call it, so the reply is a typed object.
 * With web search on, the tool cannot be forced (the model has to be free to
 * search first), so the reply is prompt-driven JSON instead.
 *
 * The system prompt carries one cache breakpoint: it is byte-identical across
 * calls until the prompt or voice profile changes, so the prefix is served
 * from the prompt cache.
 */
export async function callAnthropic(args: ProviderCallArgs): Promise<ProviderResult> {
  // The SDK retries 429/5xx with exponential backoff + jitter and honours retry-after.
  const client = new Anthropic({ apiKey: args.apiKey, maxRetries: 3 });
  const toolName = args.schemaName ?? 'emit';
  const tools: NonNullable<MessageCreateParamsNonStreaming['tools']> = [];
  if (args.webSearch) {
    tools.push({ type: 'web_search_20260209', name: 'web_search', max_uses: args.webSearch.maxUses });
  }
  const forceTool = Boolean(args.jsonSchema) && !args.webSearch;
  if (forceTool) {
    tools.push({
      name: toolName,
      description: 'Return the answer as a structured object.',
      input_schema: args.jsonSchema as Anthropic.Tool['input_schema'],
    });
  }
  try {
    const msg = await client.messages.create({
      model: args.model,
      max_tokens: args.maxTokens,
      system: [{ type: 'text', text: args.system, cache_control: { type: 'ephemeral' } }],
      messages: args.messages.map((m) => ({ role: m.role, content: m.content })),
      ...(tools.length ? { tools } : {}),
      ...(forceTool ? { tool_choice: { type: 'tool' as const, name: toolName } } : {}),
    });
    const toolBlock = msg.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === toolName,
    );
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    return {
      text: toolBlock ? JSON.stringify(toolBlock.input) : text,
      json: toolBlock ? toolBlock.input : undefined,
      inputTokens: msg.usage.input_tokens,
      outputTokens: msg.usage.output_tokens,
      cacheCreationTokens: msg.usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: msg.usage.cache_read_input_tokens ?? 0,
      webSearches: msg.usage.server_tool_use?.web_search_requests ?? 0,
      truncated: msg.stop_reason === 'max_tokens',
    };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || (e as { status?: number }).status === 401) {
      throw new ProviderAuthError('anthropic', (e as Error).message);
    }
    throw e;
  }
}
