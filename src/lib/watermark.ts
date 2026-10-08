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
 * The credit is a link preview card under the post (see lib/linkCard.ts):
 * the share image, a title and the site address. A URL in post text would
 * show as an unexplained lnkd.in short link, which reads as spam.
 *
 * `source` carries UTM tags: LinkedIn shows only the domain on the card, so
 * they cost nothing visually and tell the app's analytics where visits
 * came from.
 */
export const CARD_TITLE = 'conceptcast: researched LinkedIn posts on what you are learning';
export const CARD_DESCRIPTION = 'Turn what you are learning into researched LinkedIn posts, drafted in your voice and approved by you.';
export const CARD_SOURCE = `${APP_URL}/?utm_source=linkedin&utm_medium=post_card&utm_campaign=credit`;
export const CARD_DOMAIN = APP_URL.replace(/^https?:\/\//, '');
/** The app's share image, 1200x630: LinkedIn's link-card shape. */
export const CARD_IMAGE_URL = `${APP_URL}/opengraph-image`;

/**
 * Fallback only: used if the card cannot be attached (the image upload or
 * the card post fails), so a post never fails or goes out uncredited
 * because of the card. Says what the tool is, since LinkedIn will show the
 * URL as a short link.
 */
export const WATERMARK_LINE = `Written with conceptcast, an AI tool that turns what you are learning into researched LinkedIn posts: ${APP_URL}`;

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
