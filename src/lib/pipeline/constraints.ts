/** Machine re-checks of the writer's hard constraints. The prompt asks; this enforces. */

const BANNED_PHRASES = [
  'game-changer',
  'game changer',
  'let that sink in',
  "here's the thing",
  'i was today years old',
];

const HOOK_BANNED_OPENERS = ["let's talk about", 'let me explain', 'ever wondered'];

// Unicode bold/italic lookalikes (mathematical alphanumeric symbols).
const MATH_ALPHANUMERIC = /[\u{1D400}-\u{1D7FF}]/u;
const EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F000}-\u{1F0FF}]/u;

export const MIN_CHARS = 1_000;
export const MAX_CHARS = 1_700;

/** "I'm starting to learn X" posts: short, a few more hashtags allowed. */
export const ANNOUNCEMENT_MIN_CHARS = 300;
export const ANNOUNCEMENT_MAX_CHARS = 900;
export const ANNOUNCEMENT_MAX_HASHTAGS = 5;

/**
 * The openers that make a "starting a journey" post read like every other
 * one in the feed. Checked in the first two lines of an announcement.
 */
export const ANNOUNCEMENT_BANNED_OPENERS = [
  'excited to',
  'thrilled to',
  'happy to announce',
  'pleased to announce',
  'proud to announce',
  'day 1 of',
  'embarking on',
  'kicking off my journey',
  'new journey',
];

export type ConstraintKind = 'post' | 'announcement';

export function lengthLimits(kind: ConstraintKind = 'post'): { min: number; max: number } {
  return kind === 'announcement' ? { min: ANNOUNCEMENT_MIN_CHARS, max: ANNOUNCEMENT_MAX_CHARS } : { min: MIN_CHARS, max: MAX_CHARS };
}

export function checkHardConstraints(body: string, opts: { kind?: ConstraintKind } = {}): string[] {
  const kind = opts.kind ?? 'post';
  const { min, max } = lengthLimits(kind);
  const maxHashtags = kind === 'announcement' ? ANNOUNCEMENT_MAX_HASHTAGS : 3;
  const violations: string[] = [];
  const len = body.length;
  const lines = body.split('\n');
  const nonEmpty = lines.filter((l) => l.trim().length > 0);

  if (len < min || len > max) {
    violations.push(`length: ${len} chars (must be ${min}-${max})`);
  }

  const hook = nonEmpty.slice(0, 2).join(' ');
  if (/\?\s*$/.test(nonEmpty[0] ?? '') || /\?\s*$/.test(nonEmpty[1] ?? '')) {
    violations.push('hook: must not be a question');
  }
  const hookLower = hook.toLowerCase();
  const openers = kind === 'announcement' ? [...HOOK_BANNED_OPENERS, ...ANNOUNCEMENT_BANNED_OPENERS] : HOOK_BANNED_OPENERS;
  for (const opener of openers) {
    if (hookLower.includes(opener)) violations.push(`hook: contains banned opener "${opener}"`);
  }

  if (/\*\*|__|~~|`/.test(body)) violations.push('markdown: contains **, __, ~~ or backticks');
  if (/^#{1,6} /m.test(body)) violations.push('markdown: contains a heading line');
  if (/^\s*[-*] /m.test(body)) violations.push('markdown: contains bullet-list syntax');
  if (MATH_ALPHANUMERIC.test(body)) violations.push('unicode: bold/italic substitution characters');
  if (EMOJI.test(body)) violations.push('emoji: contains emoji');
  if (/\u2014/.test(body)) violations.push('punctuation: contains an em dash');

  const hashtags = body.match(/(^|\s)#[A-Za-z][A-Za-z0-9_]*/g) ?? [];
  if (hashtags.length > maxHashtags) violations.push(`hashtags: ${hashtags.length} found (max ${maxHashtags})`);
  if (hashtags.length > 0) {
    const lastRealLine = nonEmpty[nonEmpty.length - 1] ?? '';
    const tagsInLastLine = lastRealLine.match(/(^|\s)#[A-Za-z][A-Za-z0-9_]*/g) ?? [];
    if (tagsInLastLine.length !== hashtags.length) {
      violations.push('hashtags: must all sit on the final line');
    }
  }

  if (/(^|[\s(])@[A-Za-z]/m.test(body)) violations.push('mentions: contains an @mention');

  // An announcement closes on a real question to the reader: the last line
  // before the hashtags must end with a question mark.
  if (kind === 'announcement') {
    const lastText = [...nonEmpty].reverse().find((l) => !/^\s*(#[A-Za-z][A-Za-z0-9_]*\s*)+$/.test(l)) ?? '';
    if (!/\?\s*$/.test(lastText)) violations.push('ending: the last line before the hashtags must be a question ending in "?"');
  }

  const lower = body.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) violations.push(`slop: contains "${phrase}"`);
  }

  const openingSingles = nonEmpty.slice(0, 4).filter((l) => l.trim().split(/\s+/).length === 1);
  if (openingSingles.length >= 3) violations.push('slop: one-word-per-line dramatic opening');

  // "Line break every 1-2 sentences": flag paragraphs that run 4+ sentences.
  for (const line of nonEmpty) {
    const sentences = line.split(/[.!?]+\s/).filter((s) => s.trim().length > 0);
    if (sentences.length >= 4) {
      violations.push('formatting: a paragraph runs 4+ sentences without a line break');
      break;
    }
  }

  return violations;
}
