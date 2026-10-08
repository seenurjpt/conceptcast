import { describe, expect, it, vi } from 'vitest';
import {
  APP_URL,
  CARD_DOMAIN,
  CARD_IMAGE_URL,
  CARD_SOURCE,
  CARD_TITLE,
  LINKEDIN_HARD_CAP,
  WATERMARK_COST,
  WATERMARK_LINE,
  watermarkWouldOverflow,
  withWatermark,
} from '@/lib/watermark';
import { buildPostBody, escapeCommentary, LinkedInPublishError } from '@/lib/publishers/linkedin';
import { FRESH_IMAGE_RETRY_MS, publishWithCredit, type CreditDeps } from '@/lib/linkCard';

describe('credit copy', () => {
  it('points the card at the hosted app, tagged for analytics', () => {
    expect(APP_URL).toBe('https://conceptcast.vercel.app');
    expect(CARD_DOMAIN).toBe('conceptcast.vercel.app');
    expect(CARD_IMAGE_URL).toBe('https://conceptcast.vercel.app/opengraph-image');
    expect(CARD_SOURCE).toBe('https://conceptcast.vercel.app/?utm_source=linkedin&utm_medium=post_card&utm_campaign=credit');
    expect(CARD_TITLE.startsWith('conceptcast')).toBe(true);
  });

  it('keeps a text fallback that says what the tool is', () => {
    expect(WATERMARK_LINE).toContain('an AI tool');
    expect(WATERMARK_LINE.endsWith(APP_URL)).toBe(true);
    expect(escapeCommentary(WATERMARK_LINE)).toBe(WATERMARK_LINE);
    expect(withWatermark('Hook.\n\n#AI #Dev\n\n  ', true)).toBe(`Hook.\n\n#AI #Dev\n\n${WATERMARK_LINE}`);
    expect(withWatermark('Hook.', true).length).toBe('Hook.'.length + WATERMARK_COST);
    expect(withWatermark('Hook.\n\n#AI', false)).toBe('Hook.\n\n#AI');
    expect(watermarkWouldOverflow('x'.repeat(LINKEDIN_HARD_CAP - WATERMARK_COST))).toBe(false);
    expect(watermarkWouldOverflow('x'.repeat(LINKEDIN_HARD_CAP - WATERMARK_COST + 1))).toBe(true);
  });
});

describe('post body', () => {
  it('attaches the link card as article content', () => {
    const body = buildPostBody('urn:li:person:me', 'Post text', {
      source: CARD_SOURCE,
      title: CARD_TITLE,
      description: 'desc',
      thumbnail: 'urn:li:image:abc',
    });
    expect(body.content).toEqual({
      article: { source: CARD_SOURCE, title: CARD_TITLE, description: 'desc', thumbnail: 'urn:li:image:abc' },
    });
    expect(body.commentary).toBe('Post text');
  });

  it('leaves plain posts without content', () => {
    expect('content' in buildPostBody('urn:li:person:me', 'Post text')).toBe(false);
  });
});

/** A fake LinkedIn: each publish call returns the next scripted outcome. */
function deps(outcomes: (Error | string)[], thumb: { urn: string; fresh: boolean } | null | Error = { urn: 'urn:li:image:abc', fresh: false }) {
  const calls: { text: string; card: boolean }[] = [];
  const d: CreditDeps & { calls: typeof calls; sleep: ReturnType<typeof vi.fn>; forgetThumbnail: ReturnType<typeof vi.fn> } = {
    calls,
    publish: async (text, article) => {
      calls.push({ text, card: Boolean(article) });
      const next = outcomes.shift();
      if (next instanceof Error) throw next;
      return { postUrn: next ?? 'urn:li:share:x' };
    },
    thumbnail: async () => {
      if (thumb instanceof Error) throw thumb;
      return thumb;
    },
    forgetThumbnail: vi.fn(async () => {}),
    sleep: vi.fn(async () => {}),
  };
  return d;
}
const rejected = () => new LinkedInPublishError('LinkedIn POST /rest/posts 400: thumbnail', 400, false);

describe('publishing with the credit', () => {
  it('posts with the card when it works', async () => {
    const d = deps(['urn:li:share:1']);
    expect(await publishWithCredit('Body', d)).toEqual({ postUrn: 'urn:li:share:1', credit: 'card' });
    expect(d.calls).toEqual([{ text: 'Body', card: true }]);
    expect(d.sleep).not.toHaveBeenCalled();
  });

  it('retries once after a pause when a just-uploaded image is not ready yet', async () => {
    const d = deps([rejected(), 'urn:li:share:2'], { urn: 'urn:li:image:new', fresh: true });
    expect(await publishWithCredit('Body', d)).toEqual({ postUrn: 'urn:li:share:2', credit: 'card' });
    expect(d.sleep).toHaveBeenCalledWith(FRESH_IMAGE_RETRY_MS);
    expect(d.calls.map((c) => c.card)).toEqual([true, true]);
  });

  it('falls back to the text credit and forgets the image when the card keeps failing', async () => {
    const d = deps([rejected(), rejected(), 'urn:li:share:3'], { urn: 'urn:li:image:new', fresh: true });
    expect(await publishWithCredit('Body', d)).toEqual({ postUrn: 'urn:li:share:3', credit: 'text' });
    expect(d.calls.at(-1)).toEqual({ text: `Body\n\n${WATERMARK_LINE}`, card: false });
    expect(d.forgetThumbnail).toHaveBeenCalledOnce();
  });

  it('does not wait and retry a cached image; it falls back straight away', async () => {
    const d = deps([rejected(), 'urn:li:share:4']);
    expect(await publishWithCredit('Body', d)).toEqual({ postUrn: 'urn:li:share:4', credit: 'text' });
    expect(d.sleep).not.toHaveBeenCalled();
    expect(d.forgetThumbnail).toHaveBeenCalledOnce();
  });

  it('uses the text credit when the thumbnail cannot be prepared', async () => {
    const d = deps(['urn:li:share:5'], new Error('share image 500'));
    expect(await publishWithCredit('Body', d)).toEqual({ postUrn: 'urn:li:share:5', credit: 'text' });
    expect(d.calls).toEqual([{ text: `Body\n\n${WATERMARK_LINE}`, card: false }]);
  });

  it('never turns an auth, rate-limit or server error into a second, text-only post', async () => {
    for (const status of [401, 429, 500, 503]) {
      const d = deps([new LinkedInPublishError(`LinkedIn ${status}`, status, status !== 401)]);
      await expect(publishWithCredit('Body', d)).rejects.toThrow(`LinkedIn ${status}`);
      expect(d.calls).toHaveLength(1);
    }
  });

  it('posts without the line when there is no room for it', async () => {
    const long = 'x'.repeat(LINKEDIN_HARD_CAP - 10);
    const d = deps(['urn:li:share:6'], null);
    expect(await publishWithCredit(long, d)).toEqual({ postUrn: 'urn:li:share:6', credit: 'none' });
    expect(d.calls).toEqual([{ text: long, card: false }]);
  });
});
