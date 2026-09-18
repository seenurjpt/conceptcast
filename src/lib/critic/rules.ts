/**
 * Deterministic critic rules. No LLM. Every rule returns zero or one Failure.
 * Runs before the judgment-call LLM critique and again, alone, after a human
 * edits a draft.
 */
import { BANNED_OPENERS, BANNED_PHRASES } from '../../../scripts/seed-constants';
import { HARD_CAP, HOOK_BUDGET, TARGET_MAX, TARGET_MIN, hookLength, normalize } from '../linkedin/charCount';
import { normalizeHashtag } from '../linkedin/assemble';
import type { DraftSectionsShape, Failure } from '../schemas/post';

export interface CritiqueInput {
  sections: DraftSectionsShape;
  hashtags: string[];
  assembled: string;
  charCount: number;
  /** The chosen angle's evidence; every number in the post must trace back here. */
  concreteEvidence: string[];
}

type Rule = (input: CritiqueInput) => Failure | null;

const fail = (rule: string, detail: string, severity: Failure['severity'] = 'error'): Failure => ({ rule, detail, severity });

export const hook_length: Rule = ({ sections }) => {
  const n = hookLength(sections.hook);
  return n <= HOOK_BUDGET ? null : fail('hook_length', `hook is ${n} chars; mobile fold is ${HOOK_BUDGET}`);
};

export const HOOK_PRONOUN_RE = /^(this|that|it|they|these)\b/i;
export const hook_standalone: Rule = ({ sections }) =>
  HOOK_PRONOUN_RE.test(sections.hook.trim())
    ? fail('hook_standalone', 'hook opens with a pronoun that refers to something the reader has not seen')
    : null;

export const total_length: Rule = ({ charCount }) =>
  charCount >= TARGET_MIN && charCount <= TARGET_MAX
    ? null
    : fail('total_length', `post is ${charCount} chars; target is ${TARGET_MIN}-${TARGET_MAX}`);

export const hard_cap: Rule = ({ charCount }) =>
  charCount <= HARD_CAP ? null : fail('hard_cap', `post is ${charCount} chars; LinkedIn hard cap is ${HARD_CAP}`);

export const MARKDOWN_RE = /(\*\*|^#{1,6}\s|^\s*[-*]\s|\[.+\]\(.+\))/m;
export const no_markdown: Rule = ({ assembled }) =>
  MARKDOWN_RE.test(assembled) ? fail('no_markdown', 'post contains markdown (bold, headers, hyphen bullets, or links)') : null;

export const no_em_dash: Rule = ({ assembled }) => (/—/.test(assembled) ? fail('no_em_dash', 'post contains an em dash') : null);

export const banned_openers: Rule = ({ sections }) => {
  const hook = normalize(sections.hook).trim().toLowerCase();
  const hit = BANNED_OPENERS.find((o) => hook.startsWith(o.toLowerCase()));
  return hit ? fail('banned_openers', `hook opens with banned opener "${hit}"`) : null;
};

export const banned_phrases: Rule = ({ assembled }) => {
  const text = normalize(assembled).toLowerCase();
  const hits = BANNED_PHRASES.filter((p) => text.includes(p.toLowerCase()));
  return hits.length ? fail('banned_phrases', `post contains banned phrase(s): ${hits.map((h) => `"${h}"`).join(', ')}`) : null;
};

/** `12%`, `300ms`, `2.5x`, `10k`, `8 GB`, `4096 tokens` — unit must end the token. */
export const NUMBER_UNIT_RE = /\d+(\.\d+)?\s*(%|ms|s|x|k|GB|tokens)(?![A-Za-z])/g;
const squash = (s: string) => normalize(s).toLowerCase().replace(/\s+/g, '');

export const no_unsourced_numbers: Rule = ({ assembled, concreteEvidence }) => {
  const evidence = concreteEvidence.map(squash);
  const unsourced = new Set<string>();
  for (const m of assembled.matchAll(NUMBER_UNIT_RE)) {
    const token = squash(m[0]);
    if (!evidence.some((e) => e.includes(token))) unsourced.add(m[0].trim());
  }
  return unsourced.size
    ? fail('no_unsourced_numbers', `number(s) not in the angle's evidence: ${[...unsourced].join(', ')}`)
    : null;
};

export const CTA_BAIT_RE = /follow (me|for more)|comment ["']?\w+["']? below|repost if/i;
export const cta_not_bait: Rule = ({ sections }) =>
  CTA_BAIT_RE.test(sections.cta) ? fail('cta_not_bait', 'CTA is engagement bait') : null;

export const hashtag_format: Rule = ({ hashtags }) => {
  if (hashtags.length < 3 || hashtags.length > 5) {
    return fail('hashtag_format', `${hashtags.length} hashtags; need 3-5`);
  }
  const bad = hashtags.filter((h) => !/^#?[A-Za-z0-9]+$/.test(h.trim()) || normalizeHashtag(h).length === 0);
  return bad.length ? fail('hashtag_format', `malformed hashtag(s): ${bad.join(', ')}`) : null;
};

export const no_links_in_body: Rule = ({ assembled }) =>
  /https?:\/\//.test(assembled) ? fail('no_links_in_body', 'post contains a link; links belong in the first comment') : null;

export const RULES: Record<string, Rule> = {
  hook_length,
  hook_standalone,
  total_length,
  hard_cap,
  no_markdown,
  no_em_dash,
  banned_openers,
  banned_phrases,
  no_unsourced_numbers,
  cta_not_bait,
  hashtag_format,
  no_links_in_body,
};

export function runRules(input: CritiqueInput): Failure[] {
  const out: Failure[] = [];
  for (const rule of Object.values(RULES)) {
    const f = rule(input);
    if (f) out.push(f);
  }
  return out;
}
