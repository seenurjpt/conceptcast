import Anthropic from '@anthropic-ai/sdk';
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages/messages';
import { ProviderAuthError, type ProviderCallArgs, type ProviderResult } from './types';

/**
 * Structured output via forced tool use: the schema becomes the tool's
 * input_schema and the model must call it, so the reply is a typed object.
 * With web search on, the tool cannot be forced (the model has to be free to
 * search first), so the reply is prompt-driven JSON instead.
 *
 * Search uses the basic web_search_20250305 tool on purpose. The newer
 * 20260209 version filters results by running code in a sandbox, and in
 * practice that added minutes per research call (bash runs, retries after
 * the search cap) for no gain here. Search calls also run at low effort,
 * which keeps thinking short; the research quality comes from the sources.
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
    tools.push({ type: 'web_search_20250305', name: 'web_search', max_uses: args.webSearch.maxUses });
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
    const params: MessageCreateParamsNonStreaming = {
      model: args.model,
      max_tokens: args.maxTokens,
      system: [{ type: 'text', text: args.system, cache_control: { type: 'ephemeral' } }],
      messages: args.messages.map((m) => ({ role: m.role, content: m.content })),
      ...(tools.length ? { tools } : {}),
      ...(forceTool ? { tool_choice: { type: 'tool' as const, name: toolName } } : {}),
      ...(args.webSearch ? { output_config: { effort: 'low' as const } } : {}),
    };
    let msg = await client.messages.create(params);
    const usage = {
      input_tokens: msg.usage.input_tokens,
      output_tokens: msg.usage.output_tokens,
      cache_creation_input_tokens: msg.usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: msg.usage.cache_read_input_tokens ?? 0,
      web_search_requests: msg.usage.server_tool_use?.web_search_requests ?? 0,
    };
    // A long server-side search loop can pause; resend with the partial turn to let it finish.
    for (let resumes = 0; msg.stop_reason === 'pause_turn' && resumes < 3; resumes++) {
      const prior = msg.content;
      const next = await client.messages.create({
        ...params,
        messages: [...params.messages, { role: 'assistant', content: prior }],
      });
      usage.input_tokens += next.usage.input_tokens;
      usage.output_tokens += next.usage.output_tokens;
      usage.cache_creation_input_tokens += next.usage.cache_creation_input_tokens ?? 0;
      usage.cache_read_input_tokens += next.usage.cache_read_input_tokens ?? 0;
      usage.web_search_requests += next.usage.server_tool_use?.web_search_requests ?? 0;
      msg = { ...next, content: [...prior, ...next.content] };
    }
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
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheCreationTokens: usage.cache_creation_input_tokens,
      cacheReadTokens: usage.cache_read_input_tokens,
      webSearches: usage.web_search_requests,
      truncated: msg.stop_reason === 'max_tokens',
    };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || (e as { status?: number }).status === 401) {
      throw new ProviderAuthError('anthropic', (e as Error).message);
    }
    throw e;
  }
}
