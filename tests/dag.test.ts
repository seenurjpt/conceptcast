import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDag, eligibleConcepts, recentlyCoveredTrack } from '../src/lib/concepts/dag';
import { SEED_CONCEPTS } from '../src/lib/concepts/seed';

test('validateDag: the seed backlog is acyclic and prerequisites come first', () => {
  const order = validateDag(SEED_CONCEPTS);
  assert.equal(order.length, SEED_CONCEPTS.length);
  const pos = new Map(order.map((s, i) => [s, i]));
  for (const c of SEED_CONCEPTS) {
    for (const p of c.prerequisites) {
      assert.ok((pos.get(p) as number) < (pos.get(c.slug) as number), `${p} must precede ${c.slug}`);
    }
  }
});

test('validateDag: rejects cycles, dangling and duplicate slugs', () => {
  assert.throws(
    () =>
      validateDag([
        { slug: 'a', prerequisites: ['b'] },
        { slug: 'b', prerequisites: ['a'] },
      ]),
    /cycle/,
  );
  assert.throws(() => validateDag([{ slug: 'a', prerequisites: ['nope'] }]), /dangling/);
  assert.throws(
    () =>
      validateDag([
        { slug: 'a', prerequisites: [] },
        { slug: 'a', prerequisites: [] },
      ]),
    /Duplicate/,
  );
});

test('recentlyCoveredTrack: only the last two identical tracks block', () => {
  assert.equal(recentlyCoveredTrack('retrieval', ['retrieval', 'retrieval']), true);
  assert.equal(recentlyCoveredTrack('retrieval', ['retrieval', 'agents']), false);
  assert.equal(recentlyCoveredTrack('retrieval', ['retrieval']), false);
  assert.equal(recentlyCoveredTrack('retrieval', []), false);
});

test('eligibleConcepts: backlog only, prerequisites published, track rotation', () => {
  const concepts = [
    { slug: 'a', track: 'production', status: 'backlog', prerequisites: [] },
    { slug: 'b', track: 'production', status: 'backlog', prerequisites: ['a'] },
    { slug: 'c', track: 'retrieval', status: 'backlog', prerequisites: [] },
    { slug: 'd', track: 'retrieval', status: 'published', prerequisites: [] },
    { slug: 'e', track: 'agents', status: 'retired', prerequisites: [] },
  ];
  const published = new Set(['d']);
  assert.deepEqual(
    eligibleConcepts(concepts, published, []).map((c) => c.slug),
    ['a', 'c'],
  );
  // two retrieval posts in a row → retrieval blocked
  assert.deepEqual(
    eligibleConcepts(concepts, published, ['retrieval', 'retrieval']).map((c) => c.slug),
    ['a'],
  );
  // once a is published, b unlocks (and a itself is no longer in the backlog)
  const afterA = concepts.map((c) => (c.slug === 'a' ? { ...c, status: 'published' } : c));
  assert.deepEqual(
    eligibleConcepts(afterA, new Set(['a', 'd']), []).map((c) => c.slug),
    ['b', 'c'],
  );
});
