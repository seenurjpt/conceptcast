import { describe, expect, it } from 'vitest';
import {
  RESEARCH_TTL_MS,
  isFreshAt,
  isPoolEligible,
  planTopUp,
  rankForPool,
  researchBadge,
  type PoolCandidate,
} from '@/lib/research/pool';

const NOW = Date.parse('2026-10-04T12:00:00Z');
const DAY = 86_400_000;
const at = (offsetMs: number) => new Date(NOW + offsetMs);

let seq = 0;
function cand(over: Partial<PoolCandidate> = {}): PoolCandidate {
  seq++;
  return {
    id: over.id ?? `c${seq}`,
    slug: over.slug ?? `s${String(seq).padStart(2, '0')}`,
    status: 'backlog',
    origin: 'suggested',
    devRelevance: 5,
    timelinessBoost: 0,
    prerequisites: [],
    createdAt: at(-seq * 1000),
    researchState: null,
    ...over,
  };
}
const ready = (daysAgo = 0) => ({ status: 'ready' as const, readyAt: at(-daysAgo * DAY) });
const running = () => ({ status: 'running' as const, lockedUntil: at(60_000) });
const none = new Set<string>();

describe('research pool rules', () => {
  it('ranks by relevance plus news boost, then oldest first, then slug', () => {
    const a = cand({ slug: 'a', devRelevance: 5, createdAt: at(-1000) });
    const b = cand({ slug: 'b', devRelevance: 7 });
    const c = cand({ slug: 'c', devRelevance: 5, timelinessBoost: 4 });
    const d = cand({ slug: 'd', devRelevance: 5, createdAt: at(-5000) });
    expect(rankForPool([a, b, c, d]).map((x) => x.slug)).toEqual(['c', 'b', 'd', 'a']);
  });

  it('ranks subtopics of topics the author created ahead of the shared seed', () => {
    const seed = cand({ slug: 'seed', origin: 'seed', devRelevance: 9 });
    const mine = cand({ slug: 'mine', origin: 'suggested', devRelevance: 5, ownTopic: true });
    expect(rankForPool([seed, mine]).map((x) => x.slug)).toEqual(['mine', 'seed']);
  });

  it('never prefetches subtopics the author typed in, or ones not in the backlog or with unmet prerequisites', () => {
    expect(isPoolEligible(cand({ origin: 'user' }), none)).toBe(false);
    expect(isPoolEligible(cand({ status: 'selected' }), none)).toBe(false);
    expect(isPoolEligible(cand({ prerequisites: ['x'] }), none)).toBe(false);
    expect(isPoolEligible(cand({ prerequisites: ['x'] }), new Set(['x']))).toBe(true);
    for (const origin of ['suggested', 'seed', 'news', 'proposal'] as const) {
      expect(isPoolEligible(cand({ origin }), none)).toBe(true);
    }
  });

  it('keeps news research for 3 days and evergreen research for 30', () => {
    expect(isFreshAt(at(-2 * DAY), 'news', NOW)).toBe(true);
    expect(isFreshAt(at(-RESEARCH_TTL_MS.news), 'news', NOW)).toBe(false);
    expect(isFreshAt(at(-29 * DAY), 'suggested', NOW)).toBe(true);
    expect(isFreshAt(at(-31 * DAY), 'seed', NOW)).toBe(false);
    expect(isFreshAt(null, 'seed', NOW)).toBe(false);
  });

  it('fills the top N, starting at most two at a time', () => {
    const cs = Array.from({ length: 8 }, (_, i) => cand({ devRelevance: 10 - i }));
    const plan = planTopUp(cs, { size: 5, publishedSlugs: none, now: NOW });
    expect(plan.slots.map((s) => s.id)).toEqual(cs.slice(0, 5).map((c) => c.id));
    expect(plan.slots.every((s) => s.state === 'queued')).toBe(true);
    expect(plan.toStart).toEqual([cs[0].id, cs[1].id]);
  });

  it('counts ready and running slots, and only starts what is missing', () => {
    const cs = [
      cand({ devRelevance: 9, researchState: ready(1) }),
      cand({ devRelevance: 8, researchState: running() }),
      cand({ devRelevance: 7 }),
      cand({ devRelevance: 6, researchState: ready(2) }),
      cand({ devRelevance: 5 }),
      cand({ devRelevance: 4 }),
    ];
    const plan = planTopUp(cs, { size: 5, publishedSlugs: none, now: NOW });
    expect(plan.slots.map((s) => s.state)).toEqual(['ready', 'running', 'queued', 'ready', 'queued']);
    expect(plan.inFlight).toBe(1);
    // One already running, cap is two: start one more.
    expect(plan.toStart).toEqual([cs[2].id]);
  });

  it('counts on-demand research outside the pool against the cap', () => {
    const outside = cand({ origin: 'user', researchState: running() });
    const elsewhere = cand({ status: 'selected', researchState: running() });
    const cs = [cand(), cand(), outside, elsewhere];
    const plan = planTopUp(cs, { size: 5, publishedSlugs: none, now: NOW });
    expect(plan.inFlight).toBe(2);
    expect(plan.toStart).toEqual([]);
    expect(plan.slots).toHaveLength(2);
  });

  it('treats an expired lease as dead, so a killed run is retaken', () => {
    const dead = cand({ researchState: { status: 'running', lockedUntil: at(-1000) } });
    const plan = planTopUp([dead], { size: 5, publishedSlugs: none, now: NOW });
    expect(plan.inFlight).toBe(0);
    expect(plan.slots[0].state).toBe('queued');
    expect(plan.toStart).toEqual([dead.id]);
  });

  it('gives a failing subtopic’s slot to the next one during backoff, and retries after', () => {
    const failing = cand({ devRelevance: 9, researchState: { status: 'failed', retryAfter: at(DAY) } });
    const others = [cand({ devRelevance: 8 }), cand({ devRelevance: 7 })];
    const plan = planTopUp([failing, ...others], { size: 2, publishedSlugs: none, now: NOW });
    expect(plan.slots.map((s) => s.id)).toEqual(others.map((c) => c.id));

    const later = planTopUp([failing, ...others], { size: 2, publishedSlugs: none, now: NOW + 2 * DAY });
    expect(later.slots[0].id).toBe(failing.id);
  });

  it('treats stale research as missing', () => {
    const stale = cand({ origin: 'news', researchState: ready(4) });
    const plan = planTopUp([stale], { size: 5, publishedSlugs: none, now: NOW });
    expect(plan.slots[0].state).toBe('queued');
    expect(plan.toStart).toEqual([stale.id]);
  });

  it('does nothing with a pool size of 0', () => {
    const plan = planTopUp([cand(), cand()], { size: 0, publishedSlugs: none, now: NOW });
    expect(plan.slots).toEqual([]);
    expect(plan.toStart).toEqual([]);
  });

  it('shows a badge only for backlog rows that are ready or researching', () => {
    expect(researchBadge(cand({ researchState: ready(1) }), NOW)).toBe('ready');
    expect(researchBadge(cand({ researchState: running() }), NOW)).toBe('running');
    expect(researchBadge(cand({ status: 'published', researchState: ready(1) }), NOW)).toBe(null);
    expect(researchBadge(cand({ researchState: ready(40) }), NOW)).toBe(null);
    expect(researchBadge(cand(), NOW)).toBe(null);
  });
});
