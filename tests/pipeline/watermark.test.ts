import { describe, expect, it } from 'vitest';
import { APP_URL, LINKEDIN_HARD_CAP, WATERMARK_COST, WATERMARK_LINE, watermarkWouldOverflow, withWatermark } from '@/lib/watermark';
import { escapeCommentary } from '@/lib/publishers/linkedin';

describe('watermark', () => {
  it('points at the hosted app by default', () => {
    expect(APP_URL).toBe('https://conceptcast.vercel.app');
    expect(WATERMARK_LINE).toBe('Posted from conceptcast: https://conceptcast.vercel.app');
  });

  it('leaves the post untouched when off', () => {
    expect(withWatermark('Hook.\n\n#AI', false)).toBe('Hook.\n\n#AI');
  });

  it('adds the line after a blank line, below the hashtags, trimming trailing whitespace', () => {
    expect(withWatermark('Hook.\n\n#AI #Dev\n\n  ', true)).toBe(`Hook.\n\n#AI #Dev\n\n${WATERMARK_LINE}`);
    expect(withWatermark('Hook.', true).length).toBe('Hook.'.length + WATERMARK_COST);
  });

  it('survives LinkedIn escaping unchanged, so the URL still auto-links', () => {
    expect(escapeCommentary(WATERMARK_LINE)).toBe(WATERMARK_LINE);
  });

  it('flags posts the line would push past the 3000 character limit', () => {
    expect(watermarkWouldOverflow('x'.repeat(LINKEDIN_HARD_CAP - WATERMARK_COST))).toBe(false);
    expect(watermarkWouldOverflow('x'.repeat(LINKEDIN_HARD_CAP - WATERMARK_COST + 1))).toBe(true);
  });
});
