/**
 * The research pool against the database: leases, reuse, waiting, and the
 * background top-up. See ./pool.ts for the rules themselves.
 *
 * One lease per subtopic guards every research run, background or not, so
 * the pool and a "Write a post" click can never research the same subtopic
 * twice. A click on a subtopic whose research is already running waits for
 * that run instead of starting another.
 */
import { after } from 'next/server';
import type { Types } from 'mongoose';
import { Concept, Research, Topic, type ConceptDoc, type ResearchDoc } from '../db/models';
import { dbConnect } from '../db/connect';
import { currentUserId } from '../currentUser';
import { availableProviders } from '../llm/client';
import { users } from '../db/collections';
import { researchConcept, type Log } from '../pipeline/research';
import { isMine } from '../topics/helpers';
import {
  DEFAULT_POOL_SIZE,
  MAX_POOL_SIZE,
  RESEARCH_FAIL_BACKOFF_MS,
  RESEARCH_LEASE_MS,
  isFreshAt,
  planTopUp,
  type PoolCandidate,
  type TopUpPlan,
} from './pool';

const noop: Log = () => {};
const sleep = (n: number) => new Promise((r) => setTimeout(r, n));

/** How long a Write click waits for background research already in progress. */
const WAIT_FOR_RUNNING_MS = 150_000;
const WAIT_POLL_MS = 3_000;
/** Vercel's function limit, and how long one round of background research may take. */
const FUNCTION_LIMIT_MS = 300_000;
const ROUND_ESTIMATE_MS = 160_000;
/** Stop waiting this long before the function limit, to record the outcome. */
const RESEARCH_MARGIN_MS = 15_000;

/* ── reuse ────────────────────────────────────────────────────────────────── */

/** The newest research for a subtopic, if it is still fresh for its origin. */
export async function freshResearchFor(concept: Pick<ConceptDoc, '_id' | 'origin'>, now = Date.now()): Promise<ResearchDoc | null> {
  const latest = await Research.findOne({ conceptId: concept._id }).sort({ fetchedAt: -1 }).lean<ResearchDoc>();
  return latest && isFreshAt(latest.fetchedAt, concept.origin, now) ? latest : null;
}

async function markReady(conceptId: Types.ObjectId, doc: ResearchDoc): Promise<void> {
  await Concept.updateOne(
    { _id: conceptId },
    {
      $set: {
        'researchState.status': 'ready',
        'researchState.readyAt': doc.fetchedAt,
        'researchState.researchId': doc._id,
        'researchState.lockedUntil': null,
        'researchState.error': null,
        'researchState.retryAfter': null,
      },
    },
  );
}

/* ── the lease ────────────────────────────────────────────────────────────── */

/** Take the research lease if nobody holds a live one. Returns the claimed row or null. */
async function claimLease(conceptId: Types.ObjectId | string, source: 'pool' | 'on-demand'): Promise<ConceptDoc | null> {
  const now = new Date();
  return Concept.findOneAndUpdate(
    {
      _id: conceptId,
      $or: [
        { 'researchState.status': { $ne: 'running' } },
        { 'researchState.lockedUntil': null },
        { 'researchState.lockedUntil': { $lte: now } },
      ],
    },
    {
      $set: {
        'researchState.status': 'running',
        'researchState.lockedUntil': new Date(now.getTime() + RESEARCH_LEASE_MS),
        'researchState.startedAt': now,
        'researchState.source': source,
        'researchState.error': null,
      },
    },
    { new: true },
  ).lean<ConceptDoc>();
}

/** Research under a held lease; records the outcome either way. */
async function researchUnderLease(concept: ConceptDoc, source: 'pool' | 'on-demand', log: Log): Promise<ResearchDoc> {
  try {
    const doc = await researchConcept(concept, log);
    await markReady(concept._id, doc);
    return doc;
  } catch (e) {
    const error = (e as Error).message.slice(0, 500);
    await Concept.updateOne(
      { _id: concept._id },
      {
        $set: {
          'researchState.status': 'failed',
          'researchState.lockedUntil': null,
          'researchState.error': error,
          // Only the pool backs off. A human retrying a failed topic is allowed to.
          'researchState.retryAfter': source === 'pool' ? new Date(Date.now() + RESEARCH_FAIL_BACKOFF_MS) : null,
        },
      },
    );
    throw e;
  }
}

/* ── the Write path ───────────────────────────────────────────────────────── */

/**
 * Research for a Write click: reuse fresh research, wait for a run already in
 * progress, or research now. Used by every generate path.
 */
export async function obtainResearch(concept: ConceptDoc, log: Log = noop): Promise<ResearchDoc> {
  const fresh = await freshResearchFor(concept);
  if (fresh) {
    log(`reusing research ${fresh._id} from ${fresh.fetchedAt.toISOString()}`);
    if (concept.researchState?.status !== 'ready') await markReady(concept._id, fresh);
    return fresh;
  }

  const deadline = Date.now() + WAIT_FOR_RUNNING_MS;
  let announced = false;
  for (;;) {
    const claimed = await claimLease(concept._id, 'on-demand');
    if (claimed) return researchUnderLease(claimed, 'on-demand', log);

    if (!announced) {
      log('research for this topic is already running in the background; waiting for it');
      announced = true;
    }
    await sleep(WAIT_POLL_MS);
    const done = await freshResearchFor(concept);
    if (done) {
      log(`background research ${done._id} finished; using it`);
      return done;
    }
    if (Date.now() > deadline) {
      throw new Error('Research for this topic is still running in the background. Try again in a minute.');
    }
  }
}

export type ResearchKick = 'ready' | 'started' | 'running';

/**
 * Research for a Write click, without waiting for it. Research with web
 * search can take four minutes or more, which with drafting on top passes
 * Vercel's 300 s function limit, so the click is split in two: this starts
 * research after the response (or reports it is already ready or running),
 * the page polls the subtopic, and a second Write request drafts from the
 * finished research. The subtopic stays in the backlog meanwhile.
 */
export async function researchInBackground(
  concept: ConceptDoc,
  opts: { requestStartedAt?: number } = {},
): Promise<ResearchKick> {
  const fresh = await freshResearchFor(concept);
  if (fresh) {
    if (concept.researchState?.status !== 'ready') await markReady(concept._id, fresh);
    return 'ready';
  }
  const claimed = await claimLease(concept._id, 'on-demand');
  if (!claimed) return 'running';
  const log: Log = (m) => console.log(`[research] ${concept.slug}: ${m}`);
  // Leave a margin before the platform kills the function, so a run that
  // cannot finish is recorded as failed (retryable) rather than left looking
  // like it is still going.
  const budget = (opts.requestStartedAt ?? Date.now()) + FUNCTION_LIMIT_MS - RESEARCH_MARGIN_MS - Date.now();
  after(async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await dbConnect();
      await Promise.race([
        researchUnderLease(claimed, 'on-demand', log),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), Math.max(0, budget));
        }),
      ]);
    } catch (e) {
      if ((e as Error).message === 'timeout') {
        await markResearchTimedOut(claimed);
        log('ran out of time; marked failed');
      } else {
        // researchUnderLease records other failures on the subtopic itself.
        log(`failed: ${(e as Error).message}`);
      }
    } finally {
      clearTimeout(timer);
    }
  });
  return 'started';
}

/** Research still running when its time ran out: record it as a retryable failure. */
async function markResearchTimedOut(claimed: ConceptDoc): Promise<void> {
  await Concept.updateOne(
    { _id: claimed._id, 'researchState.status': 'running', 'researchState.startedAt': claimed.researchState.startedAt },
    {
      $set: {
        'researchState.status': 'failed',
        'researchState.lockedUntil': null,
        'researchState.error': 'Research took longer than the five minutes a request is allowed. Try again; it is usually quicker the second time.',
        'researchState.retryAfter': null,
      },
    },
  );
}

/* ── the pool ─────────────────────────────────────────────────────────────── */

export async function poolSizeFor(userId: string): Promise<number> {
  const user = await users.get(userId);
  const stored = user?.prefs?.researchPoolSize;
  const fallback = Number(process.env.RESEARCH_POOL_SIZE ?? DEFAULT_POOL_SIZE);
  const n = typeof stored === 'number' ? stored : Number.isFinite(fallback) ? fallback : DEFAULT_POOL_SIZE;
  return Math.max(0, Math.min(MAX_POOL_SIZE, Math.floor(n)));
}

export interface PoolStatus {
  size: number;
  /** Why nothing runs, when nothing can. */
  disabled: 'off' | 'no-key' | null;
  plan: TopUpPlan;
}

/** Load candidates and plan, without starting anything. */
export async function poolStatus(now = Date.now()): Promise<PoolStatus> {
  const userId = await currentUserId();
  const size = await poolSizeFor(userId);
  const empty: TopUpPlan = { slots: [], toStart: [], inFlight: 0 };
  if (size === 0) return { size, disabled: 'off', plan: empty };
  if ((await availableProviders(userId)).length === 0) return { size, disabled: 'no-key', plan: empty };

  const topics = await Topic.find(
    { archived: false, $or: [{ ownerUserId: null }, { ownerUserId: userId }] },
    { _id: 1, ownerUserId: 1, startedBy: 1 },
  ).lean<{ _id: Types.ObjectId; ownerUserId: string | null; startedBy?: string[] }[]>();
  // Topics you created or started rank first in the pool.
  const ownTopicIds = new Set(topics.filter((t) => isMine(t, userId)).map((t) => String(t._id)));
  const [rows, published, running] = await Promise.all([
    Concept.find(
      { status: 'backlog', $or: [{ topicId: { $in: topics.map((t) => t._id) } }, { topicId: null }] },
      { slug: 1, status: 1, origin: 1, devRelevance: 1, timelinessBoost: 1, prerequisites: 1, createdAt: 1, researchState: 1, topicId: 1 },
    ).lean<ConceptDoc[]>(),
    Concept.find({ status: 'published' }, { slug: 1 }).lean<{ slug: string }[]>(),
    // Research running for anything, including subtopics outside the pool, counts against the cap.
    Concept.find(
      { 'researchState.status': 'running', 'researchState.lockedUntil': { $gt: new Date(now) } },
      { slug: 1, status: 1, origin: 1, devRelevance: 1, timelinessBoost: 1, prerequisites: 1, createdAt: 1, researchState: 1 },
    ).lean<ConceptDoc[]>(),
  ]);
  const byId = new Map<string, ConceptDoc>();
  for (const c of [...rows, ...running]) byId.set(String(c._id), c);
  const cands: PoolCandidate[] = [...byId.values()].map((c) => ({
    id: String(c._id),
    slug: c.slug,
    status: c.status,
    origin: c.origin,
    devRelevance: c.devRelevance,
    timelinessBoost: c.timelinessBoost,
    prerequisites: c.prerequisites,
    createdAt: c.createdAt,
    researchState: c.researchState,
    ownTopic: c.topicId ? ownTopicIds.has(String(c.topicId)) : false,
  }));
  return { size, disabled: null, plan: planTopUp(cands, { size, publishedSlugs: new Set(published.map((p) => p.slug)), now }) };
}

/**
 * One planning pass: claim leases for the subtopics that should start.
 * Research that already exists (from an earlier Write) is adopted instead of
 * redone. Returns the claimed rows; the caller runs them.
 */
export async function topUpResearchPool(log: Log = noop): Promise<{ status: PoolStatus; started: ConceptDoc[] }> {
  const status = await poolStatus();
  const started: ConceptDoc[] = [];
  for (const id of status.plan.toStart) {
    const row = await Concept.findById(id, { _id: 1, origin: 1 }).lean<Pick<ConceptDoc, '_id' | 'origin'>>();
    if (!row) continue;
    const existing = await freshResearchFor(row);
    if (existing) {
      await markReady(row._id, existing);
      log(`pool: adopted existing research for ${id}`);
      continue;
    }
    const claimed = await claimLease(id, 'pool');
    if (claimed) started.push(claimed);
  }
  return { status, started };
}

/**
 * Keep the pool topped up, in the background. Call it from any route whose
 * request changes what the top N are (page loads, a Write, new subtopics).
 * Runs after the response is sent, inside the same serverless function, so
 * it needs no cron or extra service. Each round researches up to the
 * concurrency cap; a new round only starts if it can finish before the
 * function's time limit. Whatever is left is picked up by the next call.
 */
export function kickResearchPool(reason: string, opts: { requestStartedAt?: number } = {}): void {
  const deadline = (opts.requestStartedAt ?? Date.now()) + FUNCTION_LIMIT_MS;
  const log: Log = (m) => console.log(`[research-pool] ${m}`);

  const work = async () => {
    try {
      await dbConnect();
      for (let round = 1; round <= 3; round++) {
        if (Date.now() + ROUND_ESTIMATE_MS > deadline) break;
        const { status, started } = await topUpResearchPool(log);
        if (status.disabled || started.length === 0) break;
        log(`${reason}: round ${round}, researching ${started.map((c) => c.slug).join(', ')}`);
        const results = await Promise.allSettled(started.map((c) => researchUnderLease(c, 'pool', noop)));
        for (const [i, r] of results.entries()) {
          if (r.status === 'rejected') log(`${started[i].slug} failed: ${(r.reason as Error).message}`);
        }
      }
    } catch (e) {
      log(`top-up failed: ${(e as Error).message}`);
    }
  };

  try {
    after(work);
  } catch {
    // Outside a request (CLI, tests): run detached.
    void work();
  }
}
