import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripEmDashes, stripEmDashesDeep, hasEmDash } from '../src/lib/noEmDash';

const D = '\u2014';

test('a single dash becomes a colon, or a comma when the sentence already has a colon', () => {
  assert.equal(stripEmDashes(`and the loop is yours ${D} the model never runs anything.`), 'and the loop is yours: the model never runs anything.');
  assert.equal(
    stripEmDashes(`First guess: wrong model. Checked the docs ${D} supported.`),
    'First guess: wrong model. Checked the docs: supported.',
  );
  assert.equal(stripEmDashes(`Wire format: JSON ${D} your code runs it.`), 'Wire format: JSON, your code runs it.');
});

test('a pair inside one sentence becomes parentheses', () => {
  assert.equal(
    stripEmDashes(`The lethal trifecta ${D} private data, untrusted input, and an outbound channel ${D} and why it leaks.`),
    'The lethal trifecta (private data, untrusted input, and an outbound channel) and why it leaks.',
  );
  assert.equal(stripEmDashes(`ship it${D}or not${D}today`), 'ship it (or not) today');
});

test('line-start dashes become hyphens and lone placeholders become a hyphen', () => {
  assert.equal(stripEmDashes(`${D} Jane Doe`), '- Jane Doe');
  assert.equal(stripEmDashes(D), '-');
});

test('no stray punctuation at line ends or before other punctuation', () => {
  assert.equal(stripEmDashes(`It fails ${D}.`), 'It fails.');
  assert.equal(stripEmDashes(`first line ${D}\nsecond`), 'first line\nsecond');
});

test('deep strip covers nested structured output and leaves other values alone', () => {
  const out = stripEmDashesDeep({ facts: [{ claim: `A ${D} B`, n: 3 }], ok: true, none: null });
  assert.deepEqual(out, { facts: [{ claim: 'A: B', n: 3 }], ok: true, none: null });
  assert.equal(hasEmDash(JSON.stringify(out)), false);
});

test('text without an em dash is returned untouched', () => {
  const s = 'Range 2-3, en dash 2\u20133, colon: fine.';
  assert.equal(stripEmDashes(s), s);
});
