import { z } from 'zod';
import { ARCHETYPE_SLUGS, ArchetypeSlugSchema } from '../schemas/post';
import type { ChatMessage } from '../llm/providers/types';

export interface ExtractAnglesInput {
  title: string;
  content: string;
  tags: string[];
  ancestorTitles: string[];
  recentClaims: string[];
  slugs?: readonly string[];
}

export const ExtractAnglesOutput = z.object({
  angles: z
    .array(
      z.object({
        claim: z.string().max(200),
        archetypeSlug: ArchetypeSlugSchema,
        whoDisagrees: z.string(),
        concreteEvidence: z.array(z.string()).min(1),
        requiresAuthorInput: z.boolean(),
      }),
    )
    .length(6),
});
export type ExtractAnglesResult = z.infer<typeof ExtractAnglesOutput>;
export type CandidateAngle = ExtractAnglesResult['angles'][number];

export const EXTRACT_ANGLES_SYSTEM = 'You find the argument inside a technical topic. You are not a summarizer.';

export function extractAnglesPrompt(input: ExtractAnglesInput): { system: string; messages: ChatMessage[] } {
  const slugs = (input.slugs ?? ARCHETYPE_SLUGS).join(', ');
  const ancestors = input.ancestorTitles.length ? input.ancestorTitles.join('\n') : '(none)';
  const recent = input.recentClaims.length ? input.recentClaims.map((c) => `- ${c}`).join('\n') : '(none yet)';

  const user = `<topic>
Title: ${input.title}
Notes: ${input.content}
Tags: ${input.tags.join(', ')}
</topic>

<already_covered>
${ancestors}
</already_covered>

<recent_claims>
${recent}
</recent_claims>

Produce exactly 6 candidate angles.

An angle is a CLAIM someone competent could disagree with. Not a subject.

  Subject (reject): "How chunking works in RAG"
  Claim (accept):   "Fixed-size chunking is why your retrieval is bad,
                     and everyone blames the embedding model instead"

For each angle give:
- claim: one sentence, arguable, specific
- archetypeSlug: one of ${slugs}
- whoDisagrees: the specific person or camp that holds the opposite view
- concreteEvidence: 1-3 specific anchors (a number, a named tool, a
  failure mode, a version, a tradeoff). Only include evidence that is
  present in <topic> or is common knowledge in the field.
- requiresAuthorInput: true if the claim needs a number or war story
  that is NOT in <topic>

Reject any angle that could be written by someone who has only read
about the topic and never built with it.`;

  return { system: EXTRACT_ANGLES_SYSTEM, messages: [{ role: 'user', content: user }] };
}
