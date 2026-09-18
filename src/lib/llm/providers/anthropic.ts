import Anthropic from '@anthropic-ai/sdk';
import { ProviderAuthError, type ProviderCallArgs, type ProviderResult } from './types';

/**
 * Structured output via forced tool use: the schema becomes the tool's
 * input_schema and the model must call it, so the reply is a typed object.
 */
export async function callAnthropic(args: ProviderCallArgs): Promise<ProviderResult> {
  const client = new Anthropic({ apiKey: args.apiKey, maxRetries: 3 });
  const toolName = args.schemaName ?? 'emit';
  try {
    const msg = await client.messages.create({
      model: args.model,
      max_tokens: args.maxTokens,
      system: args.system,
      messages: args.messages.map((m) => ({ role: m.role, content: m.content })),
      ...(args.jsonSchema
        ? {
            tools: [
              {
                name: toolName,
                description: 'Return the answer as a structured object.',
                input_schema: args.jsonSchema as Anthropic.Tool['input_schema'],
              },
            ],
            tool_choice: { type: 'tool' as const, name: toolName },
          }
        : {}),
    });
    const toolBlock = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    return {
      text: toolBlock ? JSON.stringify(toolBlock.input) : text,
      json: toolBlock ? toolBlock.input : undefined,
      inputTokens: msg.usage.input_tokens,
      outputTokens: msg.usage.output_tokens,
    };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || (e as { status?: number }).status === 401) {
      throw new ProviderAuthError('anthropic', (e as Error).message);
    }
    throw e;
  }
}
