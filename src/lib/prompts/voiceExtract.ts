import { VoiceProfileFieldsSchema } from '../schemas/post';
import type { ChatMessage } from '../llm/providers/types';

export const VoiceExtractOutput = VoiceProfileFieldsSchema;

export const VOICE_EXTRACT_SYSTEM = `You are a forensic editor. Given writing samples from one person, you
describe how they write so precisely that another writer could imitate
them. Describe, do not judge. Quote short fragments from the samples as
evidence for every observation.`;

export function voiceExtractPrompt(samples: { text: string; source: string }[]): { system: string; messages: ChatMessage[] } {
  const body = samples.map((s, i) => `<sample n="${i + 1}" source="${s.source}">\n${s.text.trim()}\n</sample>`).join('\n\n');
  const user = `${body}

Fill every field:
- sentenceRhythm: typical sentence length, how they vary it, paragraph shape
- openingMoves: 3-6 ways they tend to open a piece (quote fragments)
- hedgingVocabulary: how they soften or strengthen claims ("probably", "I think", flat assertions...)
- recurringReferences: tools, people, projects, metaphors they keep coming back to
- humorRegister: dry, none, self-deprecating, absurdist... with an example
- bannedWords: words and phrases they visibly never use or would hate
- handlesUncertainty: what they do when they do not know something
- rawNotes: anything else a ghostwriter must know, free text`;
  return { system: VOICE_EXTRACT_SYSTEM, messages: [{ role: 'user', content: user }] };
}
