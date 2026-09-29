import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, uniqueSlug, TRACK_TOPICS, trackTopic, normalizeTitle, dedupeSuggestions } from '../src/lib/topics/helpers';
import { TRACKS } from '../src/lib/concepts/seed';

test('slugify: kebab-case, ascii, bounded, never empty', () => {
  assert.equal(slugify('System Design'), 'system-design');
  assert.equal(slugify('  Why consistent hashing survives a node failure (1/N)  '), 'why-consistent-hashing-survives-a-node-failure-1-n');
  assert.equal(slugify('Café & Crème'), 'cafe-creme');
  assert.equal(slugify('!!!'), 'topic');
  assert.equal(slugify(''), 'topic');
  assert.ok(slugify('x'.repeat(200)).length <= 60);
  assert.doesNotMatch(slugify('ends with punctuation!!!'), /-$/);
});

test('uniqueSlug: first free of base, base-2, base-3…', () => {
  assert.equal(uniqueSlug('caching', new Set()), 'caching');
  assert.equal(uniqueSlug('caching', new Set(['caching'])), 'caching-2');
  assert.equal(uniqueSlug('caching', new Set(['caching', 'caching-2'])), 'caching-3');
});

test('every legacy track migrates to a main topic', () => {
  for (const track of TRACKS) {
    const t = trackTopic(track);
    assert.ok(t, `no topic for track ${track}`);
    assert.equal(t.slug, track);
    assert.ok(t.title.length > 0 && t.description.length > 0);
  }
  assert.equal(Object.keys(TRACK_TOPICS).length, TRACKS.length);
  assert.equal(trackTopic('custom'), null);
  assert.equal(trackTopic('not-a-track'), null);
});

test('normalizeTitle ignores case, punctuation and filler words', () => {
  assert.equal(normalizeTitle('Load Balancing'), normalizeTitle('load-balancing'));
  assert.equal(normalizeTitle('The CAP theorem'), normalizeTitle('CAP theorem'));
  assert.equal(normalizeTitle('Sharding vs partitioning'), normalizeTitle('sharding versus partitioning'));
  assert.notEqual(normalizeTitle('Load balancing'), normalizeTitle('Load balancers'));
});

test('dedupeSuggestions drops repeats of existing subtopics and within the batch', () => {
  const existing = ['Load balancing', 'The CAP theorem'];
  const out = dedupeSuggestions(existing, [
    { title: 'load-balancing', focus: 'dup of existing' },
    { title: 'Consistent hashing', focus: 'keep' },
    { title: 'CAP Theorem', focus: 'dup of existing (filler word)' },
    { title: 'Consistent Hashing!', focus: 'dup within batch' },
    { title: 'Sharding', focus: 'keep' },
    { title: '', focus: 'empty title dropped' },
  ]);
  assert.deepEqual(
    out.map((s) => s.title),
    ['Consistent hashing', 'Sharding'],
  );
});
