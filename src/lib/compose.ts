/**
 * The composer: posts the author writes themselves. They can ask AI to edit
 * the text (one short call, in their voice, inventing nothing), then publish,
 * schedule, or save it to Drafts like any other draft.
 */
import { z } from 'zod';
import { callJson, MODELS, type SystemBlock } from './anthropic';
import { loadPrompt } from './loadPrompt';
import { Draft, type DraftDoc } from './db/models';
import { setUsageConcept } from './db/usageSink';
import { CUSTOM_MAX_CHARS } from './pipeline/constraints';
import { extractHook } from './pipeline/generate';
import { loadVoiceContext } from './voice';

export const REPHRASE_MODES = ['improve', 'shorter', 'longer', 'professional', 'casual', 'hook', 'custom'] as const;
export type RephraseMode = (typeof REPHRASE_MODES)[number];

/** What each preset asks of the editor. */
const MODE_ASK: Record<Exclude<RephraseMode, 'custom'>, string> = {
  improve: 'Polish it: fix grammar and spelling, smooth the flow, cut filler. Keep roughly the same length and the same structure.',
  shorter: 'Make it noticeably shorter, about half to two thirds of the length. Keep the main point and the strongest lines.',
  longer: 'Develop it a little further, up to about one and a half times the length, by expanding on what the author already said. Add no new facts.',
  professional: 'Make the tone more professional and precise, without becoming stiff or corporate.',
  casual: 'Make the tone more conversational and warm, as if talking to a colleague. Keep it clear.',
  hook: 'Rewrite only the opening line or two into a stronger hook that makes someone stop scrolling. Leave the rest of the post as it is.',
};

const RephraseOutput = z.object({ text: z.string().min(1) });

export function rephraseSystem(styleGuide: string): SystemBlock[] {
  const blocks: SystemBlock[] = [{ type: 'text', text: loadPrompt('compose-rephrase') }];
  if (styleGuide.trim()) {
    blocks.push({ type: 'text', text: `# The author's voice notes (how they write, not facts about them)\n\n${styleGuide.trim()}` });
  }
  return blocks;
}

export function rephrasePrompt(text: string, mode: RephraseMode, instruction?: string): string {
  const ask = mode === 'custom' ? (instruction?.trim() || MODE_ASK.improve) : MODE_ASK[mode];
  const extra = mode !== 'custom' && instruction?.trim() ? `\n\nAlso: ${instruction.trim()}` : '';
  return `# The requested edit\n\n${ask}${extra}\n\n# The post\n\n${text}`;
}

/** The edited post. The LLM client strips em dashes from every answer. */
export async function rephrasePost(text: string, mode: RephraseMode, instruction?: string): Promise<string> {
  const { styleGuide } = await loadVoiceContext();
  setUsageConcept('compose');
  try {
    const out = await callJson({
      stage: `compose-${mode}`,
      model: MODELS.heavy,
      system: rephraseSystem(styleGuide),
      maxTokens: 2_000,
      messages: [{ role: 'user', content: rephrasePrompt(text, mode, instruction) }],
      schema: RephraseOutput,
    });
    return out.text.trim().slice(0, CUSTOM_MAX_CHARS);
  } finally {
    setUsageConcept(null);
  }
}

/** Hashtags as the review queue expects them: every #tag in the text, at most 5. */
function hashtagsOf(body: string): string[] {
  return [...body.matchAll(/(?:^|\s)(#[A-Za-z][A-Za-z0-9_]*)/g)].map((m) => m[1]).slice(0, 5);
}

/** Saves the post as a pending draft; publishing or scheduling then goes through the usual approve route. */
export async function createCustomDraft(body: string): Promise<DraftDoc> {
  const text = body.trim();
  const doc = await Draft.create({
    kind: 'custom',
    conceptId: null,
    researchId: null,
    topicId: null,
    angle: 'custom',
    hook: extractHook(text),
    body: text,
    charCount: text.length,
    hashtags: hashtagsOf(text),
    critique: null,
    announce: null,
    version: 1,
    status: 'pending',
    editedByHuman: false,
  });
  return doc.toObject() as DraftDoc;
}
