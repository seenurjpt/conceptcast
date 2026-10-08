/**
 * The conceptcast credit as a LinkedIn link preview card: the app's share
 * image, a title and the site address under the post, the way a product
 * link looks in the feed.
 *
 * The thumbnail is uploaded to LinkedIn once per account and reused (an
 * uploaded image can back any number of posts). A freshly uploaded image may
 * still be processing, and this token cannot read its status, so the first
 * card post retries once after a pause. If the card still cannot be
 * attached, the post goes out with the text credit instead: a post is never
 * lost, or left uncredited, because of the card.
 */
import { LinkedInAuth, type LinkedInAuthDoc } from './db/models';
import { getAuth, publishPost, uploadImage, LinkedInPublishError, type ArticleCard } from './publishers/linkedin';
import {
  CARD_DESCRIPTION,
  CARD_IMAGE_URL,
  CARD_SOURCE,
  CARD_TITLE,
  LINKEDIN_HARD_CAP,
  withWatermark,
} from './watermark';

/** How the credit went out: the card, the text-line fallback, or none (no room for the text line). */
export type Credit = 'card' | 'text' | 'none';

export interface Thumbnail {
  urn: string;
  /** Uploaded just now, so LinkedIn may still be processing it. */
  fresh: boolean;
}

export interface CreditDeps {
  publish(text: string, article?: ArticleCard): Promise<{ postUrn: string }>;
  thumbnail(): Promise<Thumbnail | null>;
  forgetThumbnail(): Promise<void>;
  sleep(ms: number): Promise<void>;
  log?(message: string): void;
}

/** Pause before retrying a card whose image was uploaded moments ago. */
export const FRESH_IMAGE_RETRY_MS = 5_000;

/**
 * Only LinkedIn rejecting the request as invalid is treated as a card
 * problem. Auth, rate-limit and server errors propagate to the normal retry
 * path: retrying those as a text post could publish the same post twice.
 */
export function isCardRejection(e: unknown): boolean {
  return e instanceof LinkedInPublishError && (e.status === 400 || e.status === 422);
}

export function cardFor(thumbnail?: string): ArticleCard {
  return { source: CARD_SOURCE, title: CARD_TITLE, description: CARD_DESCRIPTION, thumbnail };
}

async function publishWithTextCredit(body: string, deps: CreditDeps): Promise<{ postUrn: string; credit: Credit }> {
  const text = withWatermark(body, true);
  if (text.normalize('NFC').length > LINKEDIN_HARD_CAP) {
    deps.log?.('credit: no room for the text line; posting without it');
    return { ...(await deps.publish(body)), credit: 'none' };
  }
  return { ...(await deps.publish(text)), credit: 'text' };
}

/** Publish `body` with the conceptcast credit, as a card when possible. */
export async function publishWithCredit(body: string, deps: CreditDeps): Promise<{ postUrn: string; credit: Credit }> {
  let thumb: Thumbnail | null = null;
  try {
    thumb = await deps.thumbnail();
  } catch (e) {
    deps.log?.(`credit: thumbnail unavailable (${(e as Error).message}); using the text credit`);
  }
  if (!thumb) return publishWithTextCredit(body, deps);

  try {
    return { ...(await deps.publish(body, cardFor(thumb.urn))), credit: 'card' };
  } catch (e) {
    if (!isCardRejection(e)) throw e;
    deps.log?.(`credit: card rejected (${(e as Error).message})`);
  }

  if (thumb.fresh) {
    await deps.sleep(FRESH_IMAGE_RETRY_MS);
    try {
      return { ...(await deps.publish(body, cardFor(thumb.urn))), credit: 'card' };
    } catch (e) {
      if (!isCardRejection(e)) throw e;
      deps.log?.(`credit: card rejected again (${(e as Error).message})`);
    }
  }

  // The image may have been purged or never processed: upload a fresh one next time.
  await deps.forgetThumbnail();
  return publishWithTextCredit(body, deps);
}

/* ── wiring to Mongo and LinkedIn ─────────────────────────────────────────── */

async function storedOrUploadedThumbnail(auth: LinkedInAuthDoc): Promise<Thumbnail> {
  // Images belong to the member who uploaded them; a different account needs its own.
  if (auth.cardImageUrn && auth.cardImageOwner === auth.memberUrn) return { urn: auth.cardImageUrn, fresh: false };
  const res = await fetch(CARD_IMAGE_URL, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`share image ${res.status} from ${CARD_IMAGE_URL}`);
  const urn = await uploadImage(await res.arrayBuffer(), auth);
  await LinkedInAuth.updateOne(
    { _id: auth._id },
    { $set: { cardImageUrn: urn, cardImageOwner: auth.memberUrn, cardImageAt: new Date() } },
  );
  return { urn, fresh: true };
}

/** The real thing: LinkedIn for publishing and images, Mongo for the cached image. */
export async function publishWithLinkCard(body: string, log: (m: string) => void = () => {}): Promise<{ postUrn: string; credit: Credit }> {
  const auth = await getAuth();
  if (!auth) throw new LinkedInPublishError('LinkedIn is not connected.', 401, false);
  return publishWithCredit(body, {
    publish: (text, article) => publishPost(text, auth, { article }),
    thumbnail: () => storedOrUploadedThumbnail(auth),
    forgetThumbnail: async () => {
      await LinkedInAuth.updateOne({ _id: auth._id }, { $set: { cardImageUrn: null, cardImageOwner: null, cardImageAt: null } });
    },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    log,
  });
}
