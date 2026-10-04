/**
 * The research pool, as pure functions: no database, no network, safe to
 * import from the browser (the subtopic rows use `researchBadge`).
 *
 * Rule: keep the top N writable subtopics researched, so "Write a post" on
 * one of them skips straight to drafting. Subtopics the author typed in
 * themselves (origin 'user') are never prefetched; they are researched when
 * the author clicks Write, at the usual speed.
 */
import type { ResearchStatus } from '../db/models';

/** The parts of a subtopic's research state the rules read. Dates arrive as strings over JSON. */
export interface PoolResearchState {
  status?: ResearchStatus;
  readyAt?: Date | string | null;
  lockedUntil?: Date | string | null;
  retryAfter?: Date | string | null;
}

export const DEFAULT_POOL_SIZE = 5;
export const MAX_POOL_SIZE = 10;
/** Background research runs at most this many at once, across all subtopics. */
export const MAX_CONCURRENT_RESEARCH = 2;
/** A running lease outlives Vercel's 300s function limit, so a killed run is retaken soon after. */
export const RESEARCH_LEASE_MS = 6 * 60 * 1000;
/** After a failed background run, skip the subtopic for this long. */
export const RESEARCH_FAIL_BACKOFF_MS = 24 * 60 * 60 * 1000;

const DAY = 24 * 60 * 60 * 1000;
/** News moves fast; evergreen research stays good for a month. */
export const RESEARCH_TTL_MS = { news: 3 * DAY, evergreen: 30 * DAY } as const;

export type Origin = 'seed' | 'proposal' | 'news' | 'user' | 'suggested';

export interface PoolCandidate {
  id: string;
  slug: string;
  status: string;
  origin?: Origin;
  devRelevance: number;
  timelinessBoost: number;
  prerequisites: string[];
  createdAt: Date | string;
  researchState?: PoolResearchState | null;
  /**
   * Belongs to a main topic the author created. Those rank first: they are
   * what the author chose to write about, and their subtopics carry a
   * default relevance that the hand-scored shared seed would otherwise
   * always beat.
   */
  ownTopic?: boolean;
}

const ms = (d: Date | string | null | undefined): number | null => (d ? new Date(d).getTime() : null);

export function researchTtlMs(origin: Origin | undefined): number {
  return origin === 'news' ? RESEARCH_TTL_MS.news : RESEARCH_TTL_MS.evergreen;
}

/** Research finished at `readyAt` is still good to write from. */
export function isFreshAt(readyAt: Date | string | null | undefined, origin: Origin | undefined, now = Date.now()): boolean {
  const t = ms(readyAt);
  return t !== null && now - t < researchTtlMs(origin);
}

export function isResearchFresh(c: Pick<PoolCandidate, 'origin' | 'researchState'>, now = Date.now()): boolean {
  return c.researchState?.status === 'ready' && isFreshAt(c.researchState.readyAt, c.origin, now);
}

export function isResearchRunning(c: Pick<PoolCandidate, 'researchState'>, now = Date.now()): boolean {
  const until = ms(c.researchState?.lockedUntil);
  return c.researchState?.status === 'running' && until !== null && until > now;
}

export function inFailureBackoff(c: Pick<PoolCandidate, 'researchState'>, now = Date.now()): boolean {
  const until = ms(c.researchState?.retryAfter);
  return c.researchState?.status === 'failed' && until !== null && until > now;
}

/** In the backlog, not typed in by the author, every prerequisite published. */
export function isPoolEligible(c: PoolCandidate, publishedSlugs: ReadonlySet<string>): boolean {
  return c.status === 'backlog' && c.origin !== 'user' && c.prerequisites.every((p) => publishedSlugs.has(p));
}

/**
 * Best first: the author's own topics before shared ones, then relevance plus
 * any news boost, then oldest first, then slug, so the order is stable.
 */
export function rankForPool<T extends PoolCandidate>(cands: T[]): T[] {
  return [...cands].sort(
    (a, b) =>
      Number(Boolean(b.ownTopic)) - Number(Boolean(a.ownTopic)) ||
      b.devRelevance + b.timelinessBoost - (a.devRelevance + a.timelinessBoost) ||
      (ms(a.createdAt) ?? 0) - (ms(b.createdAt) ?? 0) ||
      a.slug.localeCompare(b.slug),
  );
}

export type SlotState = 'ready' | 'running' | 'queued';

export interface TopUpPlan {
  /** The pool as it should be: the top N, each with what it is doing. */
  slots: { id: string; slug: string; state: SlotState }[];
  /** Pool members to start researching now (respects the concurrency cap). */
  toStart: string[];
  /** Research running anywhere right now, pool or on-demand. */
  inFlight: number;
}

/**
 * Which subtopics make up the pool and which to start. A subtopic in failure
 * backoff gives up its slot to the next one, so one broken source does not
 * leave the pool permanently short.
 */
export function planTopUp(
  cands: PoolCandidate[],
  opts: { size: number; publishedSlugs: ReadonlySet<string>; now?: number; maxConcurrent?: number },
): TopUpPlan {
  const now = opts.now ?? Date.now();
  const maxConcurrent = opts.maxConcurrent ?? MAX_CONCURRENT_RESEARCH;
  const inFlight = cands.filter((c) => isResearchRunning(c, now)).length;
  const size = Math.max(0, Math.min(MAX_POOL_SIZE, Math.floor(opts.size)));

  const slots: TopUpPlan['slots'] = [];
  for (const c of rankForPool(cands.filter((c) => isPoolEligible(c, opts.publishedSlugs)))) {
    if (slots.length >= size) break;
    if (inFailureBackoff(c, now)) continue;
    const state: SlotState = isResearchFresh(c, now) ? 'ready' : isResearchRunning(c, now) ? 'running' : 'queued';
    slots.push({ id: c.id, slug: c.slug, state });
  }

  const capacity = Math.max(0, maxConcurrent - inFlight);
  const toStart = slots
    .filter((s) => s.state === 'queued')
    .slice(0, capacity)
    .map((s) => s.id);
  return { slots, toStart, inFlight };
}

/** What a subtopic row shows. null = nothing to say. */
export function researchBadge(c: Pick<PoolCandidate, 'origin' | 'researchState' | 'status'>, now = Date.now()): 'ready' | 'running' | null {
  if (c.status !== 'backlog') return null;
  if (isResearchFresh(c, now)) return 'ready';
  if (isResearchRunning(c, now)) return 'running';
  return null;
}
