/**
 * Shared by the server and the screens: what to call a post the author wrote
 * in the composer, which has no subtopic to name it.
 */

/** Its first line, trimmed to fit a row; "Your post" if it has none. */
export function customTitle(hook: string | null | undefined): string {
  const first = (hook ?? '').split('\n').find((l) => l.trim())?.trim() ?? '';
  if (!first) return 'Your post';
  return first.length > 90 ? `${first.slice(0, 89).trimEnd()}…` : first;
}
