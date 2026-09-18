/**
 * LinkedIn counts UTF-16 code units. JS `.length` already is UTF-16 units, so
 * an emoji or a Unicode "bold" letter (both astral) counts as 2 and a grapheme
 * cluster made of several code points counts each of them. The one thing JS
 * does not do for us is normalisation: "é" typed as e + combining acute is 2
 * units in NFD but 1 in NFC, and LinkedIn stores NFC. Normalise first.
 */

export const HARD_CAP = 3000;
/** Mobile fold: the only safe zone for a hook. */
export const HOOK_BUDGET = 140;
export const DESKTOP_FOLD = 210;
export const TARGET_MIN = 1400;
export const TARGET_MAX = 2200;

/** Raw UTF-16 code-unit count (no normalisation). */
export const luLength = (s: string): number => s.length;

export const normalize = (s: string): string => s.normalize('NFC');

/** What LinkedIn will count for this text. Use it for hooks and whole posts alike. */
export const hookLength = (s: string): number => normalize(s).length;
