import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkHardConstraints } from '../src/lib/pipeline/constraints';

const filler = (n: number) => Array.from({ length: n }, (_, i) => `Sentence number ${i + 1} adds detail.`).join('\n\n');

function goodPost(): string {
  const body =
    'Prompt cache writes cost 1.25x a normal input token, and reads cost 0.1x.\n' +
    'That ratio means a cached prefix pays for itself on the second call.\n\n' +
    filler(26) +
    '\n\nCheck your prompt order tomorrow: static system text first, volatile fields last.\n\n#promptcaching #llm';
  return body;
}

test('a well-formed post passes', () => {
  const body = goodPost();
  assert.ok(body.length >= 1000 && body.length <= 1700, `length ${body.length}`);
  assert.deepEqual(checkHardConstraints(body), []);
});

test('length outside 1000–1700 is flagged', () => {
  assert.match(checkHardConstraints('too short')[0], /length/);
  assert.ok(checkHardConstraints(goodPost() + filler(40)).some((v) => /length/.test(v)));
});

test('a question hook, markdown, emoji, slop and mentions are flagged', () => {
  const body = 'Ever wondered why caching is cheap?\nLet me explain **this** 🚀 @someone here\'s the thing\n\n' + filler(22) + '\n\n#a #b #c #d';
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
  const body = 'A strong claim with 42 numbers.\nAnd a second line. #early\n\n' + filler(22) + '\n\nDo this tomorrow.\n\n#late';
  assert.ok(checkHardConstraints(body).some((x) => /final line/.test(x)));
});

test('unicode bold substitution is flagged', () => {
  const body = '𝐁𝐨𝐥𝐝 claim with 3 numbers.\nSecond line.\n\n' + filler(22) + '\n\nDo this.\n\n#x';
  assert.ok(checkHardConstraints(body).some((x) => /unicode/.test(x)));
});
