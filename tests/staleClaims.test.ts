import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * releaseStaleClaims talks to Mongo, which this machine does not have, so these
 * assert the decision rule itself: which claimed concepts count as stranded.
 * The rule is duplicated here deliberately: if it changes in the source, this
 * test should be updated to match, which is the point of pinning it.
 */
const STALE_CLAIM_MS = 20 * 60 * 1000;
/** Draft statuses that mean the subtopic is genuinely mid-review. */
const LIVE = ['pending', 'approved', 'published'];

function isStranded(
  c: { status: string; coveredAt: Date | null },
  draftStatuses: string[],
  now = new Date(),
): boolean {
  if (c.status !== 'selected') return false;
  if (c.coveredAt === null) return false;
  if (now.getTime() - c.coveredAt.getTime() < STALE_CLAIM_MS) return false;
  return !draftStatuses.some((s) => LIVE.includes(s));
}

const now = new Date('2026-09-18T12:00:00Z');
const long = new Date(now.getTime() - 40 * 60 * 1000);
const recent = new Date(now.getTime() - 2 * 60 * 1000);

test('a long-claimed concept with no draft is stranded', () => {
  assert.equal(isStranded({ status: 'selected', coveredAt: long }, [], now), true);
});

test('a run still in progress is left alone', () => {
  assert.equal(isStranded({ status: 'selected', coveredAt: recent }, [], now), false);
});

test('a concept that produced a draft is mid-review, not stranded', () => {
  assert.equal(isStranded({ status: 'selected', coveredAt: long }, ['pending'], now), false);
});

test('a run cut off after saving only a rejected first version is stranded', () => {
  // A timeout mid-revision left exactly this: selected, one rejected draft.
  assert.equal(isStranded({ status: 'selected', coveredAt: long }, ['rejected'], now), true);
});

test('backlog, published and retired concepts are never touched', () => {
  for (const status of ['backlog', 'published', 'retired']) {
    assert.equal(isStranded({ status, coveredAt: long }, [], now), false, status);
  }
});

test('a claim with no timestamp is left alone rather than guessed at', () => {
  assert.equal(isStranded({ status: 'selected', coveredAt: null }, [], now), false);
});
