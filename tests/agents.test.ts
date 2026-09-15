import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickAngles } from '../src/lib/agents/writer';
import { combinedScore } from '../src/lib/agents/selector';
import { passes } from '../src/lib/agents/critic';
import { writerOutputSchema } from '../src/lib/schemas';
import { extractHook, extractHashtags } from '../src/lib/pipeline/generate';
import { engagementScore } from '../src/lib/feedback';

test('pickAngles rotates by track and uses debug-story for difficulty 1', () => {
  assert.deepEqual(pickAngles({ track: 'production', difficulty: 1 }), ['mechanism', 'tradeoff', 'debug-story']);
  assert.deepEqual(pickAngles({ track: 'production', difficulty: 2 }), ['mechanism', 'tradeoff', 'misconception']);
  assert.deepEqual(pickAngles({ track: 'retrieval', difficulty: 2 }), ['mechanism', 'misconception', 'tradeoff']);
  assert.deepEqual(pickAngles({ track: 'agents', difficulty: 1 }), ['mechanism', 'misconception', 'debug-story']);
  for (const track of ['model-internals', 'evals', 'adaptation', 'security']) {
    const angles = pickAngles({ track, difficulty: 3 });
    assert.equal(angles.length, 3);
    assert.equal(new Set(angles).size, 3);
    assert.equal(angles[0], 'mechanism');
  }
});

test('writerOutputSchema enforces exactly the requested angles', () => {
  const schema = writerOutputSchema(['mechanism', 'debug-story']);
  assert.ok(schema.safeParse({ variants: [{ angle: 'debug-story', body: 'x' }, { angle: 'mechanism', body: 'y' }] }).success);
  assert.equal(schema.safeParse({ variants: [{ angle: 'mechanism', body: 'x' }] }).success, false);
  assert.equal(schema.safeParse({ variants: [{ angle: 'mechanism', body: 'x' }, { angle: 'tradeoff', body: 'y' }] }).success, false);
  assert.equal(schema.safeParse({ variants: [{ angle: 'mechanism', body: 'x' }, { angle: 'mechanism', body: 'y' }] }).success, false);
});

test('combinedScore weights surprise double and adds relevance + timeliness', () => {
  const base = { teachability: 5, surprise: 5, applicability: 5, devRelevance: 0, timelinessBoost: 0 };
  assert.equal(combinedScore(base), 20);
  assert.equal(combinedScore({ ...base, surprise: 9 }), 28);
  assert.equal(combinedScore({ ...base, devRelevance: 10, timelinessBoost: 8 }), 29);
});

test('passes requires score >= 7, no auto-fails, no constraint violations', () => {
  assert.equal(passes({ score: 7, autoFails: [] }, []), true);
  assert.equal(passes({ score: 6, autoFails: [] }, []), false);
  assert.equal(passes({ score: 9, autoFails: ['grounding'] }, []), false);
  assert.equal(passes({ score: 9, autoFails: [] }, ['length: 1800 chars']), false);
});

test('extractHook takes the first two non-empty lines; hashtags capped at 3', () => {
  const body = '\nLine one.\n\nLine two.\nLine three.\n\n#a #b #c #d';
  assert.equal(extractHook(body), 'Line one.\nLine two.');
  assert.deepEqual(extractHashtags(body), ['#a', '#b', '#c']);
});

test('engagementScore weights comments and shares above reactions', () => {
  assert.equal(engagementScore({ reactions: 10, comments: 0, shares: 0, impressions: null }), 10);
  assert.equal(engagementScore({ reactions: 0, comments: 2, shares: 1, impressions: 200 }), 12);
});
