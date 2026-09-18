import { z } from 'zod';
import { BANNED_OPENERS, BANNED_PHRASES } from '../../../scripts/seed-constants';
import type { ArchetypeDoc, Failure, VoiceProfileFields } from '../schemas/post';
import type { ChatMessage } from '../llm/providers/types';

export const WriteDraftOutput = z.object({
  hook: z.string(),
  rehook: z.string(),
  context: z.string(),
  body: z.string(),
  takeaway: z.string(),
  cta: z.string(),
  hashtags: z.array(z.string()).min(3).max(5),
});
export type WriteDraftResult = z.infer<typeof WriteDraftOutput>;

export interface WriteDraftInput {
  profile: VoiceProfileFields;
  exemplars: string[];
  archetype: Pick<ArchetypeDoc, 'name' | 'structure'>;
  claim: string;
  whoDisagrees: string;
  verifiedAnchors: string[];
  revisionNotes?: Failure[];
}

/** One line per profile field; arrays joined with `; `. */
export function serializeProfile(p: VoiceProfileFields): string {
  const line = (k: string, v: string | string[]) => `${k}: ${Array.isArray(v) ? v.join('; ') : v}`;
  return [
    line('sentenceRhythm', p.sentenceRhythm),
    line('openingMoves', p.openingMoves),
    line('hedgingVocabulary', p.hedgingVocabulary),
    line('recurringReferences', p.recurringReferences),
    line('humorRegister', p.humorRegister),
    line('bannedWords', p.bannedWords),
    line('handlesUncertainty', p.handlesUncertainty),
    line('rawNotes', p.rawNotes),
  ].join('\n');
}

export function writeDraftSystem(profile: VoiceProfileFields): string {
  return `You write LinkedIn posts in one specific person's voice. You are that
person writing, not an assistant writing for them.

<voice_profile>
${serializeProfile(profile)}
</voice_profile>

<hard_rules>
- First person. You built this. You are not reporting on someone's work.
- One idea per post. If you are explaining two things, you have failed.
- Concrete before abstract in every paragraph.
- Plain text only. No markdown, no asterisks, no headers, no hyphen
  bullets. Use → or • inside the body if you need a list.
- No em-dashes. Use a period or a comma.
- Line break after every one or two sentences. White space is the format.
- Never state a number, benchmark, or metric that is not in
  <verified_anchors>.
- Never open with: ${BANNED_OPENERS.map((s) => `"${s}"`).join(', ')}
- Never use: ${BANNED_PHRASES.map((s) => `"${s}"`).join(', ')}
- The CTA is a real question you actually want answered, never
  "follow for more" or "comment X below".
</hard_rules>`;
}

export function writeDraftPrompt(input: WriteDraftInput): { system: string; messages: ChatMessage[] } {
  const slots = input.archetype.structure
    .map((s) => {
      const bounds = [s.minChars ? `min ${s.minChars} chars` : null, s.maxChars ? `max ${s.maxChars} chars` : null]
        .filter(Boolean)
        .join(', ');
      return `${s.slot}: ${s.guidance}${bounds ? ` (${bounds})` : ''}`;
    })
    .join('\n');

  const anchors = input.verifiedAnchors.length ? input.verifiedAnchors.join('\n') : '(none: use no numbers at all)';

  const revision = input.revisionNotes?.length
    ? `\n<revision_notes>\nThe previous draft failed review. Fix every item:\n${input.revisionNotes
        .map((f) => `- [${f.rule}] ${f.detail}`)
        .join('\n')}\n</revision_notes>\n`
    : '';

  const user = `<exemplars>
${input.exemplars.join('\n---\n')}
</exemplars>

<archetype name="${input.archetype.name}">
${slots}
</archetype>

<angle>
Claim: ${input.claim}
The people who disagree: ${input.whoDisagrees}
</angle>

<verified_anchors>
${anchors}
</verified_anchors>
${revision}
Write the post. Fill every slot. The hook must be under 140 characters
and must make sense to someone who sees nothing else.`;

  return { system: writeDraftSystem(input.profile), messages: [{ role: 'user', content: user }] };
}
