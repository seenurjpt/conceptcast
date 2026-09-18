import { describe, expect, it } from 'vitest';
import { HARD_CAP, HOOK_BUDGET, TARGET_MAX, TARGET_MIN, hookLength, luLength, normalize } from '@/lib/linkedin/charCount';

describe('charCount', () => {
  it('exports the LinkedIn constants', () => {
    expect(HARD_CAP).toBe(3000);
    expect(HOOK_BUDGET).toBe(140);
    expect(TARGET_MIN).toBe(1400);
    expect(TARGET_MAX).toBe(2200);
  });

  it('counts an emoji as 2 UTF-16 units', () => {
    expect(luLength('🚀')).toBe(2);
    expect(hookLength('🚀')).toBe(2);
    expect(hookLength('a🚀b')).toBe(4);
  });

  it('counts Unicode "bold" letters as 2 units each', () => {
    // Mathematical bold capital A..D, U+1D400..
    expect(hookLength('𝐀𝐁𝐂𝐃')).toBe(8);
    expect(hookLength('ABCD')).toBe(4);
  });

  it('counts CRLF as 2 and LF as 1', () => {
    expect(hookLength('a\r\nb')).toBe(4);
    expect(hookLength('a\nb')).toBe(3);
  });

  it('normalises to NFC before counting combining marks', () => {
    const nfd = 'é'; // e + combining acute
    expect(luLength(nfd)).toBe(2);
    expect(normalize(nfd)).toBe('é');
    expect(hookLength(nfd)).toBe(1);
    expect(hookLength('café')).toBe(hookLength('café'));
  });

  it('keeps ZWJ emoji sequences as their full code-unit count (LinkedIn does not count graphemes)', () => {
    const family = '👨‍👩‍👧'; // 3 emoji (2 units each) + 2 ZWJ (1 unit each)
    expect(hookLength(family)).toBe(8);
  });
});
