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

/**
 * Researched posts: short enough to read in one sitting on a phone, long
 * enough to define the term, show how it works and say what to do. The
 * writer aims for 700-900; this is the hard window.
 */
export const MIN_CHARS = 600;
export const MAX_CHARS = 1_000;

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

/** A post the author wrote themselves: LinkedIn's own cap, nothing stricter. */
export const CUSTOM_MAX_CHARS = 3_000;

export type ConstraintKind = 'post' | 'announcement' | 'custom';

export function lengthLimits(kind: ConstraintKind = 'post'): { min: number; max: number } {
  if (kind === 'custom') return { min: 1, max: CUSTOM_MAX_CHARS };
  return kind === 'announcement' ? { min: ANNOUNCEMENT_MIN_CHARS, max: ANNOUNCEMENT_MAX_CHARS } : { min: MIN_CHARS, max: MAX_CHARS };
}

/**
 * Does the post open with its term? Case-insensitive, ignoring leading
 * whitespace and an opening quote, so "Backpressure is…" and "backpressure:"
 * both count for the term "Backpressure".
 */
export function opensWithTerm(body: string, term: string): boolean {
  const first = (body.split('\n').find((l) => l.trim().length > 0) ?? '').trim().replace(/^["'“‘]/, '');
  const t = term.trim().toLowerCase();
  return t.length > 0 && first.toLowerCase().startsWith(t);
}

export function checkHardConstraints(
  body: string,
  opts: {
    kind?: ConstraintKind;
    /** The concept's name as the writer chose it; a post must open with it. Omitted for older drafts. */
    term?: string | null;
  } = {},
): string[] {
  const kind = opts.kind ?? 'post';
  const { min, max } = lengthLimits(kind);
  // The author's own words: the house style rules are for the AI writer,
  // not for them. Only the platform limit is enforced.
  if (kind === 'custom') {
    const len = body.trim().length;
    return len < min || body.length > max ? [`length: ${body.length} chars (must be ${min}-${max})`] : [];
  }
  const maxHashtags = kind === 'announcement' ? ANNOUNCEMENT_MAX_HASHTAGS : 3;
  const violations: string[] = [];
  const len = body.length;
  const lines = body.split('\n');
  const nonEmpty = lines.filter((l) => l.trim().length > 0);

  if (len < min || len > max) {
    violations.push(`length: ${len} chars (must be ${min}-${max})`);
  }

  // Term first: a reader who has never heard of it knows from line one what the post is about.
  if (kind === 'post' && opts.term && !opensWithTerm(body, opts.term)) {
    violations.push(`opening: the first line must start with the term "${opts.term.trim()}"`);
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

  // "Line break every 1-2 sentences". Posts are held to it exactly (3+ is
  // flagged) because dense paragraphs are what made them feel long;
  // announcements keep the older 4+ threshold.
  const maxSentences = kind === 'post' ? 2 : 3;
  for (const line of nonEmpty) {
    const sentences = line.split(/[.!?]+\s/).filter((s) => s.trim().length > 0);
    if (sentences.length > maxSentences) {
      violations.push(`formatting: a paragraph runs ${maxSentences + 1}+ sentences without a line break`);
      break;
    }
  }

  return violations;
}
