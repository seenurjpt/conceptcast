import { z } from 'zod';
import type { ChatMessage } from '../llm/providers/types';

export const VerifyAnchorsOutput = z.object({
  verifiedAnchors: z.array(z.string()),
  unverifiableClaims: z.array(z.string()),
});
export type VerifyAnchorsResult = z.infer<typeof VerifyAnchorsOutput>;

export const VERIFY_ANCHORS_SYSTEM =
  'You are a fact-checker for a technical author. You never invent a number, benchmark, or version. ' +
  'You only sort evidence the author already has into "safe to state" and "cannot be stated without a source".';

export function verifyAnchorsPrompt(input: {
  title: string;
  content: string;
  claim: string;
  concreteEvidence: string[];
}): { system: string; messages: ChatMessage[] } {
  const user = `<topic>
Title: ${input.title}
Notes: ${input.content}
</topic>

<claim>${input.claim}</claim>

<evidence>
${input.concreteEvidence.map((e) => `- ${e}`).join('\n')}
</evidence>

For each evidence item decide:
- verifiedAnchors: items that are stated in <topic>, or are widely known,
  stable facts in the field (a named tool, a documented behaviour, a
  well-known tradeoff). Copy the item text exactly as given.
- unverifiableClaims: items that assert a specific number, benchmark,
  percentage, latency, or cost that is NOT in <topic> and could not be
  cited from the author's own experience. Copy the item text exactly.

Every input item must appear in exactly one list. Never add an item that
was not in <evidence>. Never rewrite a number.`;
  return { system: VERIFY_ANCHORS_SYSTEM, messages: [{ role: 'user', content: user }] };
}
