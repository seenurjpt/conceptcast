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

export function checkHardConstraints(body: string): string[] {
  const violations: string[] = [];
  const len = body.length;
  const lines = body.split('\n');
  const nonEmpty = lines.filter((l) => l.trim().length > 0);

  if (len < MIN_CHARS || len > MAX_CHARS) {
    violations.push(`length: ${len} chars (must be ${MIN_CHARS}-${MAX_CHARS})`);
  }

  const hook = nonEmpty.slice(0, 2).join(' ');
  if (/\?\s*$/.test(nonEmpty[0] ?? '') || /\?\s*$/.test(nonEmpty[1] ?? '')) {
    violations.push('hook: must not be a question');
  }
  const hookLower = hook.toLowerCase();
  for (const opener of HOOK_BANNED_OPENERS) {
    if (hookLower.includes(opener)) violations.push(`hook: contains banned opener "${opener}"`);
  }

  if (/\*\*|__|~~|`/.test(body)) violations.push('markdown: contains **, __, ~~ or backticks');
  if (/^#{1,6} /m.test(body)) violations.push('markdown: contains a heading line');
  if (/^\s*[-*] /m.test(body)) violations.push('markdown: contains bullet-list syntax');
  if (MATH_ALPHANUMERIC.test(body)) violations.push('unicode: bold/italic substitution characters');
  if (EMOJI.test(body)) violations.push('emoji: contains emoji');

  const hashtags = body.match(/(^|\s)#[A-Za-z][A-Za-z0-9_]*/g) ?? [];
  if (hashtags.length > 3) violations.push(`hashtags: ${hashtags.length} found (max 3)`);
  if (hashtags.length > 0) {
    const lastRealLine = nonEmpty[nonEmpty.length - 1] ?? '';
    const tagsInLastLine = lastRealLine.match(/(^|\s)#[A-Za-z][A-Za-z0-9_]*/g) ?? [];
    if (tagsInLastLine.length !== hashtags.length) {
      violations.push('hashtags: must all sit on the final line');
    }
  }

  if (/(^|[\s(])@[A-Za-z]/m.test(body)) violations.push('mentions: contains an @mention');

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
