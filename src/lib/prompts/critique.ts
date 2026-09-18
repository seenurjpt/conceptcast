import { z } from 'zod';
import type { VoiceProfileFields } from '../schemas/post';
import type { ChatMessage } from '../llm/providers/types';
import { serializeProfile } from './writeDraft';

export const CritiqueOutput = z.object({
  singleIdea: z.boolean(),
  voiceMatch: z.number().int().min(1).max(5),
  hookEarnsTheClick: z.boolean(),
  notes: z.array(z.string()),
});
export type CritiqueResult = z.infer<typeof CritiqueOutput>;

export const CRITIQUE_SYSTEM = 'You are a harsh editor. You are not encouraging. You only report problems.';

export function critiquePrompt(input: { profile: VoiceProfileFields; assembled: string }): {
  system: string;
  messages: ChatMessage[];
} {
  const user = `<voice_profile>
${serializeProfile(input.profile)}
</voice_profile>
<post>
${input.assembled}
</post>

Answer three things:
1. singleIdea — does this post teach exactly one thing? A post that
   explains a concept AND a tool AND a tradeoff is three posts.
2. voiceMatch (1-5) — would a reader who knows this author's writing
   believe they wrote this? 3 means "plausible but generic".
3. hookEarnsTheClick — after reading only the first line, is there an
   open loop that costs something to leave unresolved?

Then list specific problems. No praise.`;
  return { system: CRITIQUE_SYSTEM, messages: [{ role: 'user', content: user }] };
}
