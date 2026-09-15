import type { TextBlockParam } from '@anthropic-ai/sdk/resources/messages/messages';
import { loadPrompt } from '../loadPrompt';
import type { VoiceContext } from '../voice';

/** The concept fields the agents need — satisfied by both SeedConcept and ConceptDoc. */
export interface ConceptMeta {
  slug: string;
  title: string;
  track: string;
  focus: string;
  difficulty: 1 | 2 | 3;
}

/**
 * Builds the system prompt: static prompt files first, then the voice profile,
 * with one cache breakpoint on the final block. Everything before the
 * breakpoint is byte-identical across calls until the voice profile changes,
 * so the prefix is served from cache (spec §13).
 */
export function buildSystem(promptNames: string[], voice?: VoiceContext): TextBlockParam[] {
  const blocks: TextBlockParam[] = promptNames.map((name) => ({
    type: 'text' as const,
    text: loadPrompt(name),
  }));
  if (voice) blocks.push({ type: 'text', text: renderVoiceBlock(voice) });
  blocks[blocks.length - 1] = {
    ...blocks[blocks.length - 1],
    cache_control: { type: 'ephemeral' },
  };
  return blocks;
}

export function renderVoiceBlock(voice: VoiceContext): string {
  const examples = voice.examplePosts.length
    ? voice.examplePosts.map((p, i) => `<example_post n="${i + 1}">\n${p}\n</example_post>`).join('\n\n')
    : '(no example posts yet — fall back to the defaults in the writing instructions)';
  return (
    `# Voice profile\n\n## Audience\n\n${voice.audienceDescription}\n\n` +
    `## Style guide\n\n${voice.styleGuide || '(no style guide extracted yet — use the defaults)'}\n\n` +
    `## Example posts (best performers; copy the shape, never the content)\n\n${examples}`
  );
}

export function researchBlock(research: unknown): string {
  return `# Research file\n\n\`\`\`json\n${JSON.stringify(research, null, 2)}\n\`\`\``;
}
