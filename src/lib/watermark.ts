/**
 * The optional "Posted from conceptcast" line under a published post.
 *
 * It is appended at send time, never stored in the draft, so the draft, the
 * critic and the character meter all keep judging the post itself. The
 * choice lives on the publication row, so a post scheduled for later still
 * gets the line when the cron publishes it.
 *
 * Client-safe: the review page imports this for its preview.
 */

/** LinkedIn's hard limit on post text, in UTF-16 code units. */
export const LINKEDIN_HARD_CAP = 3000;

/** Public URL of the app. Override with NEXT_PUBLIC_APP_URL (e.g. a custom domain). */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://conceptcast.vercel.app').replace(/\/+$/, '');

/**
 * LinkedIn auto-links a bare URL in post text, so the line needs no markup.
 * Nothing here is in LinkedIn's reserved set, so escaping leaves it intact.
 */
export const WATERMARK_LINE = `Posted from conceptcast: ${APP_URL}`;

/** Characters the watermark adds, including the blank line above it. */
export const WATERMARK_COST = 2 + WATERMARK_LINE.length;

export function withWatermark(body: string, enabled: boolean): string {
  if (!enabled) return body;
  return `${body.replace(/\s+$/, '')}\n\n${WATERMARK_LINE}`;
}

/** True when adding the line would push the post past LinkedIn's limit. */
export function watermarkWouldOverflow(body: string): boolean {
  return withWatermark(body, true).normalize('NFC').length > LINKEDIN_HARD_CAP;
}
