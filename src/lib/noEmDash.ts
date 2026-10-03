/**
 * The app never shows an em dash (U+2014). Prompts ask the model not to write
 * them; this is the guarantee, applied to every model reply in lib/llm/client
 * and by scripts/strip-em-dashes.ts for text already in the database.
 *
 * The character is only ever written as the escape \u2014 in this codebase,
 * so the source itself stays free of it.
 */

export const EM_DASH = '\u2014';
const HAS_EM_DASH = /\u2014/;

/**
 * Rewrites em dashes into the punctuation they stand for:
 *   a pair inside one sentence  "the trifecta <d> data, input <d> and why" -> "the trifecta (data, input) and why"
 *   a single dash               "Checked the docs <d> supported"          -> "Checked the docs: supported"
 *     (a comma instead when that sentence already has a colon)
 *   at the start of a line      "<d> Jane Doe"                            -> "- Jane Doe"
 *   a lone placeholder          "<d>"                                     -> "-"
 */
export function stripEmDashes(text: string): string {
  if (!HAS_EM_DASH.test(text)) return text;
  return text
    .split('\n')
    .map(rewriteLine)
    .join('\n');
}

function rewriteLine(line: string): string {
  if (!HAS_EM_DASH.test(line)) return line;
  if (/^\s*\u2014+\s*$/.test(line)) return line.replace(/\u2014+/, '-');

  let s = line
    // Attribution or list-like use at the start of a line.
    .replace(/^([ \t]*)\u2014+[ \t]*/, '$1- ')
    // A pair within one sentence is a parenthetical.
    .replace(/[ \t]*\u2014+[ \t]*([^\u2014.!?]{1,160}?)[ \t]*\u2014+[ \t]*/g, (_m, inner: string) => ` (${inner.trim()}) `);

  // What is left is a single dash: a colon, unless the sentence already has one.
  s = s.replace(/[ \t]*\u2014+[ \t]*/g, (_m, offset: number, whole: string) => {
    const sentenceStart = Math.max(
      whole.lastIndexOf('. ', offset),
      whole.lastIndexOf('! ', offset),
      whole.lastIndexOf('? ', offset),
    );
    const sentence = whole.slice(sentenceStart + 1, offset);
    return sentence.includes(':') ? ', ' : ': ';
  });

  return (
    s
      // Tidy what the rewrite leaves next to other punctuation.
      .replace(/[,:] *([.,;:!?)\]])/g, '$1')
      .replace(/([(\[]) +/g, '$1')
      .replace(/ +([).,;:!?\]])/g, '$1')
      .replace(/ {2,}/g, ' ')
      .replace(/[ \t]*[,:][ \t]*$/, '')
      .replace(/[ \t]+$/, '')
  );
}

/** Applies stripEmDashes to every string inside a JSON-like value. */
export function stripEmDashesDeep<T>(value: T): T {
  if (typeof value === 'string') return stripEmDashes(value) as T;
  if (Array.isArray(value)) return value.map((v) => stripEmDashesDeep(v)) as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = stripEmDashesDeep(v);
    return out as T;
  }
  return value;
}

export function hasEmDash(text: string): boolean {
  return HAS_EM_DASH.test(text);
}
