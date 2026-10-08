import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkHardConstraints, opensWithTerm, MIN_CHARS, MAX_CHARS } from '../src/lib/pipeline/constraints';

const filler = (n: number) => Array.from({ length: n }, (_, i) => `Sentence number ${i + 1} adds detail.`).join('\n\n');

/** A short, term-first post in the target 700-900 character range. */
function goodPost(): string {
  return (
    'Prompt caching is the provider reusing the start of your prompt instead of reading it again.\n' +
    'Cache writes cost 1.25x a normal input token, and reads cost 0.1x.\n\n' +
    filler(14) +
    '\n\nCheck your prompt order tomorrow: static system text first, volatile fields last.\n\n#promptcaching #llm'
  );
}

test('the post length window is 600-1,000 characters', () => {
  assert.equal(MIN_CHARS, 600);
  assert.equal(MAX_CHARS, 1000);
});

test('a well-formed, term-first post passes', () => {
  const body = goodPost();
  assert.ok(body.length >= 700 && body.length <= 900, `length ${body.length}`);
  assert.deepEqual(checkHardConstraints(body, { term: 'Prompt caching' }), []);
});

test('length outside 600-1,000 is flagged', () => {
  assert.match(checkHardConstraints('too short')[0], /length/);
  assert.ok(checkHardConstraints(goodPost() + '\n\n' + filler(10)).some((v) => /length/.test(v)));
});

test('a post must open with its term, case-insensitively', () => {
  assert.equal(opensWithTerm(goodPost(), 'prompt caching'), true);
  assert.equal(opensWithTerm('  "Backpressure is a slow service telling a fast one to wait.', 'Backpressure'), true);
  assert.equal(opensWithTerm('Backpressure: the stop signal.\nMore.', 'Backpressure'), true);
  assert.equal(opensWithTerm('A bounded queue does more than hold messages.', 'Backpressure'), false);
  // The term has to lead, not just appear somewhere in line one.
  assert.equal(opensWithTerm('Most people misread backpressure.', 'Backpressure'), false);
  assert.equal(opensWithTerm('Backpressure is real.', '  '), false);

  const wrong = goodPost().replace('Prompt caching is', 'The provider can reuse');
  assert.ok(checkHardConstraints(wrong, { term: 'Prompt caching' }).some((v) => /opening: the first line must start with the term "Prompt caching"/.test(v)));
  // Older drafts carry no term and are not held to the rule.
  assert.ok(!checkHardConstraints(wrong).some((v) => /opening/.test(v)));
});

test('a paragraph of three sentences is flagged for posts, not announcements', () => {
  const dense = goodPost().replace(
    'Sentence number 1 adds detail.',
    'One fact here. Another fact here. A third fact here.',
  );
  assert.ok(checkHardConstraints(dense, { term: 'Prompt caching' }).some((v) => /3\+ sentences/.test(v)));
  assert.ok(!checkHardConstraints(dense, { kind: 'announcement' }).some((v) => /sentences/.test(v)));
});

test('a question hook, markdown, emoji, slop and mentions are flagged', () => {
  const body = 'Ever wondered why caching is cheap?\nLet me explain **this** 🚀 @someone here\'s the thing\n\n' + filler(10) + '\n\n#a #b #c #d';
  const v = checkHardConstraints(body);
  assert.ok(v.some((x) => /hook: must not be a question/.test(x)));
  assert.ok(v.some((x) => /banned opener/.test(x)));
  assert.ok(v.some((x) => /markdown/.test(x)));
  assert.ok(v.some((x) => /emoji/.test(x)));
  assert.ok(v.some((x) => /slop/.test(x)));
  assert.ok(v.some((x) => /mention/.test(x)));
  assert.ok(v.some((x) => /hashtags: 4/.test(x)));
});

test('hashtags must all sit on the last line', () => {
  const body = 'A strong claim with 42 numbers.\nAnd a second line. #early\n\n' + filler(14) + '\n\nDo this tomorrow.\n\n#late';
  assert.ok(checkHardConstraints(body).some((x) => /final line/.test(x)));
});

test('unicode bold substitution is flagged', () => {
  const body = '𝐁𝐨𝐥𝐝 claim with 3 numbers.\nSecond line.\n\n' + filler(14) + '\n\nDo this.\n\n#x';
  assert.ok(checkHardConstraints(body).some((x) => /unicode/.test(x)));
});
