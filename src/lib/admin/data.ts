/**
 * Read-only figures for the admin panel, one function per page.
 *
 * Nothing here returns a secret: environment variables are reported as set
 * or missing, AI keys only by provider name, LinkedIn tokens only by expiry.
 * Every query is bounded (date windows, limits, aggregates), so a page costs
 * a handful of small reads however long the app has been running.
 */
import mongoose, { type Types } from 'mongoose';
import { Concept, Draft, Publication, Topic, VoiceProfile, type ConceptDoc, type DraftDoc, type PublicationDoc, type TopicDoc } from '../db/models';
import { COLLECTIONS, getDb } from '../db/collections';
import { dbConnect } from '../db/connect';
import { authState, getAuth } from '../publishers/linkedin';
import { customTitle } from '../customPost';
import { pipelineMode } from '../api';
import { adminConfigured } from './session';
import { listAdminEvents, type AdminAuditDoc } from './audit';
import { appSessionStats, type AppSessionStats } from '../appSessions';

const DAY = 86_400_000;
const STALE_CLAIM_MS = 20 * 60_000;

export interface DayPoint {
  start: string;
  value: number;
}

/** The last `days` days (oldest first) as YYYY-MM-DD keys, starting at local midnight. */
function dayKeys(days: number, now = new Date()): string[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, i) => new Date(start.getTime() - (days - 1 - i) * DAY).toISOString());
}
function bucket(points: { at: Date; value: number }[], days: number, now = new Date()): DayPoint[] {
  const keys = dayKeys(days, now);
  const totals = new Map(keys.map((k) => [k, 0]));
  for (const p of points) {
    const d = new Date(p.at);
    d.setHours(0, 0, 0, 0);
    const k = d.toISOString();
    if (totals.has(k)) totals.set(k, (totals.get(k) ?? 0) + p.value);
  }
  return keys.map((k) => ({ start: k, value: Math.round((totals.get(k) ?? 0) * 10000) / 10000 }));
}

interface LlmCallRow {
  at: Date;
  stage: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
  ok: boolean;
  error: string | null;
}
async function llmCallsSince(since: Date): Promise<LlmCallRow[]> {
  const db = await getDb();
  return db
    .collection<LlmCallRow>(COLLECTIONS.llmCalls)
    .find({ at: { $gte: since } }, { projection: { _id: 0, at: 1, stage: 1, provider: 1, model: 1, inputTokens: 1, outputTokens: 1, latencyMs: 1, costUsd: 1, ok: 1, error: 1 } })
    .sort({ at: 1 })
    .toArray();
}

/** Drafts the critic killed: rejected, never touched by a person, and not superseded by a revision. */
function isFinal(d: Pick<DraftDoc, '_id'>, revised: Set<string>): boolean {
  return !revised.has(String(d._id));
}

/* ── overview ─────────────────────────────────────────────────────────────── */

export interface AttentionItem {
  tone: 'down' | 'attention';
  title: string;
  detail: string;
  href: string;
}

export async function overviewData(now = new Date()) {
  // Pages render alongside the layout, so each loader connects for itself.
  await dbConnect();
  const since30 = new Date(now.getTime() - 30 * DAY);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [drafts30, draftCounts, pubCounts, calls30, auth, failedResearch, stuck] = await Promise.all([
    Draft.find({ createdAt: { $gte: since30 } }, { status: 1, createdAt: 1, rejectionReason: 1, critique: 1 }).lean<DraftDoc[]>(),
    Draft.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Publication.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    llmCallsSince(since30),
    getAuth(),
    Concept.countDocuments({ status: 'backlog', 'researchState.status': 'failed' }),
    stuckSubtopics(now),
  ]);

  const revised = new Set(drafts30.map((d) => d.critique?.revisionOf).filter(Boolean).map(String));
  const finals = drafts30.filter((d) => d.critique && isFinal(d, revised));
  const killed = finals.filter((d) => d.status === 'rejected' && !d.rejectionReason).length;
  const passRate = finals.length ? (finals.length - killed) / finals.length : null;

  const monthCalls = calls30.filter((c) => c.at >= monthStart);
  const failedCalls = calls30.filter((c) => !c.ok).length;
  const counts = (rows: { _id: string; n: number }[]) => Object.fromEntries(rows.map((r) => [r._id, r.n])) as Record<string, number>;
  const pubs = counts(pubCounts);
  const state = authState(auth, now);

  const attention: AttentionItem[] = [];
  if (state !== 'ok') {
    attention.push({
      tone: state === 'refresh-due' ? 'attention' : 'down',
      title: state === 'missing' ? 'LinkedIn is not connected' : state === 'refresh-due' ? 'LinkedIn access renews soon' : 'LinkedIn access has expired',
      detail: state === 'missing' ? 'Nothing can be published until someone signs in.' : 'Publishing stops when it lapses; the author must sign in again.',
      href: '/admin/publishing',
    });
  }
  if (pubs.failed) attention.push({ tone: 'down', title: `${pubs.failed} failed publish${pubs.failed === 1 ? '' : 'es'}`, detail: 'Posts that did not reach LinkedIn.', href: '/admin/publishing' });
  if (failedResearch) attention.push({ tone: 'attention', title: `${failedResearch} research run${failedResearch === 1 ? '' : 's'} failed`, detail: 'Retryable from the topic page.', href: '/admin/pipeline' });
  if (stuck.length) attention.push({ tone: 'down', title: `${stuck.length} stuck subtopic${stuck.length === 1 ? '' : 's'}`, detail: 'In flight with no live draft; released automatically after 20 minutes.', href: '/admin/pipeline' });
  const recentCalls = calls30.filter((c) => c.at.getTime() > now.getTime() - DAY);
  const recentFail = recentCalls.filter((c) => !c.ok).length;
  if (recentCalls.length >= 5 && recentFail / recentCalls.length > 0.2) {
    attention.push({ tone: 'down', title: 'AI calls are failing', detail: `${recentFail} of ${recentCalls.length} in the last 24 hours.`, href: '/admin/usage' });
  }

  return {
    kpis: {
      drafts30: drafts30.length,
      draftsTotal: Object.values(counts(draftCounts)).reduce((a, b) => a + b, 0),
      passRate,
      published: pubs.published ?? 0,
      scheduled: pubs.scheduled ?? 0,
      spendMonth: monthCalls.reduce((s, c) => s + c.costUsd, 0),
      callsMonth: monthCalls.length,
      failureRate30: calls30.length ? failedCalls / calls30.length : null,
    },
    spendDaily: bucket(calls30.map((c) => ({ at: c.at, value: c.costUsd })), 30, now),
    draftsDaily: bucket(drafts30.map((d) => ({ at: d.createdAt, value: 1 })), 30, now),
    attention,
  };
}

/* ── AI usage ─────────────────────────────────────────────────────────────── */

export interface UsageGroup {
  key: string;
  calls: number;
  failures: number;
  costUsd: number;
  avgLatencyMs: number;
  inputTokens: number;
  outputTokens: number;
}
function groupBy(rows: LlmCallRow[], key: (r: LlmCallRow) => string): UsageGroup[] {
  const m = new Map<string, UsageGroup & { latency: number }>();
  for (const r of rows) {
    const k = key(r);
    const g = m.get(k) ?? { key: k, calls: 0, failures: 0, costUsd: 0, avgLatencyMs: 0, inputTokens: 0, outputTokens: 0, latency: 0 };
    g.calls++;
    if (!r.ok) g.failures++;
    g.costUsd += r.costUsd;
    g.latency += r.latencyMs;
    g.inputTokens += r.inputTokens;
    g.outputTokens += r.outputTokens;
    m.set(k, g);
  }
  return [...m.values()]
    .map(({ latency, ...g }) => ({ ...g, avgLatencyMs: g.calls ? latency / g.calls : 0 }))
    .sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls);
}

export const USAGE_RANGES = [7, 30, 90] as const;

export async function usageData(days: number, now = new Date()) {
  await dbConnect();
  const rows = await llmCallsSince(new Date(now.getTime() - days * DAY));
  const ok = rows.filter((r) => r.ok);
  return {
    days,
    totals: {
      calls: rows.length,
      failures: rows.length - ok.length,
      costUsd: rows.reduce((s, r) => s + r.costUsd, 0),
      inputTokens: rows.reduce((s, r) => s + r.inputTokens, 0),
      outputTokens: rows.reduce((s, r) => s + r.outputTokens, 0),
      avgLatencyMs: ok.length ? ok.reduce((s, r) => s + r.latencyMs, 0) / ok.length : 0,
    },
    spendDaily: bucket(rows.map((r) => ({ at: r.at, value: r.costUsd })), days, now),
    byProvider: groupBy(rows, (r) => r.provider),
    byModel: groupBy(rows, (r) => r.model),
    // Retries count with the stage they retried ("writer:retry" is the writer).
    byStage: groupBy(rows, (r) => r.stage.split(':')[0]),
    failures: rows.filter((r) => !r.ok).slice(-25).reverse(),
    slowest: [...ok].sort((a, b) => b.latencyMs - a.latencyMs).slice(0, 10),
  };
}

/* ── pipeline ─────────────────────────────────────────────────────────────── */

async function stuckSubtopics(now = new Date()) {
  const claimed = await Concept.find(
    { status: 'selected', coveredAt: { $ne: null, $lt: new Date(now.getTime() - STALE_CLAIM_MS) } },
    { title: 1, coveredAt: 1, topicId: 1 },
  ).lean<Pick<ConceptDoc, '_id' | 'title' | 'coveredAt' | 'topicId'>[]>();
  if (!claimed.length) return [];
  const live = await Draft.distinct('conceptId', {
    conceptId: { $in: claimed.map((c) => c._id) },
    status: { $in: ['pending', 'approved', 'published'] },
  });
  const liveSet = new Set(live.map(String));
  return claimed.filter((c) => !liveSet.has(String(c._id)));
}

export async function pipelineData(now = new Date()) {
  await dbConnect();
  const [byStatus, researchRows, writing, stuck, researcherCalls, topics] = await Promise.all([
    Concept.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Concept.find(
      { status: 'backlog', 'researchState.status': { $in: ['running', 'failed', 'ready'] } },
      { title: 1, topicId: 1, researchState: 1 },
    ).lean<Pick<ConceptDoc, '_id' | 'title' | 'topicId' | 'researchState'>[]>(),
    Concept.find({ writeLockedUntil: { $gt: now } }, { title: 1, topicId: 1, writeLockedUntil: 1 }).lean<
      Pick<ConceptDoc, '_id' | 'title' | 'topicId' | 'writeLockedUntil'>[]
    >(),
    stuckSubtopics(now),
    llmCallsSince(new Date(now.getTime() - 30 * DAY)).then((r) => r.filter((c) => c.stage === 'researcher')),
    Topic.find({}, { title: 1 }).lean<Pick<TopicDoc, '_id' | 'title'>[]>(),
  ]);
  const topicTitle = new Map(topics.map((t) => [String(t._id), t.title]));
  const withTopic = <T extends { topicId: Types.ObjectId | null }>(r: T) => ({ ...r, topic: r.topicId ? (topicTitle.get(String(r.topicId)) ?? null) : null });

  // A "running" lease past its time is a run that died: show it as such.
  const running = researchRows.filter((r) => r.researchState.status === 'running');
  const latencies = researcherCalls.filter((c) => c.ok).map((c) => c.latencyMs).sort((a, b) => a - b);
  const pct = (p: number) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))] : 0);

  return {
    byStatus: Object.fromEntries(byStatus.map((r) => [r._id, r.n])) as Record<string, number>,
    research: {
      ready: researchRows.filter((r) => r.researchState.status === 'ready').length,
      running: running.filter((r) => r.researchState.lockedUntil && r.researchState.lockedUntil > now).map(withTopic),
      abandoned: running.filter((r) => !r.researchState.lockedUntil || r.researchState.lockedUntil <= now).map(withTopic),
      failed: researchRows.filter((r) => r.researchState.status === 'failed').map(withTopic),
    },
    writing: writing.map(withTopic),
    stuck: stuck.map(withTopic),
    researcher: {
      runs: researcherCalls.length,
      failures: researcherCalls.filter((c) => !c.ok).length,
      medianMs: pct(0.5),
      p90Ms: pct(0.9),
      maxMs: latencies[latencies.length - 1] ?? 0,
      // Vercel's function limit; research close to it risks a timeout.
      overFourMinutes: latencies.filter((l) => l > 240_000).length,
    },
  };
}

/* ── publishing ───────────────────────────────────────────────────────────── */

async function draftTitles(ids: Types.ObjectId[]): Promise<Map<string, string>> {
  const drafts = await Draft.find({ _id: { $in: ids } }, { hook: 1, kind: 1, conceptId: 1, topicId: 1 }).lean<DraftDoc[]>();
  const concepts = await Concept.find({ _id: { $in: drafts.map((d) => d.conceptId).filter(Boolean) } }, { title: 1 }).lean<Pick<ConceptDoc, '_id' | 'title'>[]>();
  const conceptTitle = new Map(concepts.map((c) => [String(c._id), c.title]));
  return new Map(
    drafts.map((d) => [
      String(d._id),
      d.kind === 'custom'
        ? customTitle(d.hook)
        : d.kind === 'announcement'
          ? 'Topic announcement'
          : (conceptTitle.get(String(d.conceptId)) ?? customTitle(d.hook)),
    ]),
  );
}

export async function publishingData(now = new Date()) {
  await dbConnect();
  const [auth, byStatus, upcoming, recent, failed] = await Promise.all([
    getAuth(),
    Publication.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Publication.find({ status: 'scheduled' }).sort({ scheduledFor: 1 }).limit(20).lean<PublicationDoc[]>(),
    Publication.find({ status: 'published' }).sort({ publishedAt: -1 }).limit(15).lean<PublicationDoc[]>(),
    Publication.find({ status: 'failed' }).sort({ scheduledFor: -1 }).limit(20).lean<PublicationDoc[]>(),
  ]);
  const titles = await draftTitles([...upcoming, ...recent, ...failed].map((p) => p.draftId));
  const row = (p: PublicationDoc) => ({
    id: String(p._id),
    title: titles.get(String(p.draftId)) ?? 'Untitled',
    scheduledFor: p.scheduledFor,
    publishedAt: p.publishedAt,
    postUrn: p.postUrn,
    error: p.error,
    attempts: p.attempts,
    metrics: p.metrics,
  });
  return {
    linkedin: auth
      ? {
          state: authState(auth, now),
          member: auth.memberName ?? null,
          expiresAt: auth.expiresAt,
          refreshExpiresAt: auth.refreshExpiresAt ?? null,
          scopes: auth.scopes ?? [],
        }
      : { state: 'missing' as const, member: null, expiresAt: null, refreshExpiresAt: null, scopes: [] as string[] },
    byStatus: Object.fromEntries(byStatus.map((r) => [r._id, r.n])) as Record<string, number>,
    upcoming: upcoming.map(row),
    recent: recent.map(row),
    failed: failed.map(row),
  };
}

/* ── content ──────────────────────────────────────────────────────────────── */

export async function contentData() {
  await dbConnect();
  const db = await getDb();
  const [topics, perTopic, draftsByStatus, draftsByKind, voice, exemplars, samples] = await Promise.all([
    Topic.find({}, { title: 1, ownerUserId: 1, archived: 1, createdAt: 1 }).sort({ createdAt: 1 }).lean<TopicDoc[]>(),
    Concept.aggregate<{ _id: { topicId: Types.ObjectId | null; status: string }; n: number }>([
      { $group: { _id: { topicId: '$topicId', status: '$status' }, n: { $sum: 1 } } },
    ]),
    Draft.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Draft.aggregate<{ _id: string | null; n: number }>([{ $group: { _id: '$kind', n: { $sum: 1 } } }]),
    VoiceProfile.findOne({ key: 'singleton' }, { styleGuide: 1, examplePosts: 1 }).lean<{ styleGuide?: string; examplePosts?: string[] } | null>(),
    db.collection(COLLECTIONS.exemplars).countDocuments(),
    db.collection(COLLECTIONS.voiceSamples).countDocuments(),
  ]);
  const counts = new Map<string, Record<string, number>>();
  for (const r of perTopic) {
    const k = String(r._id.topicId);
    const c = counts.get(k) ?? {};
    c[r._id.status] = r.n;
    counts.set(k, c);
  }
  return {
    topics: topics.map((t) => ({
      id: String(t._id),
      title: t.title,
      shared: !t.ownerUserId,
      archived: t.archived,
      createdAt: t.createdAt,
      subtopics: counts.get(String(t._id)) ?? {},
    })),
    draftsByStatus: Object.fromEntries(draftsByStatus.map((r) => [r._id, r.n])) as Record<string, number>,
    draftsByKind: Object.fromEntries(draftsByKind.map((r) => [r._id ?? 'post', r.n])) as Record<string, number>,
    voice: { styleGuide: Boolean(voice?.styleGuide?.trim()), examplePosts: voice?.examplePosts?.length ?? 0, samples },
    exemplars,
  };
}

/* ── system ───────────────────────────────────────────────────────────────── */

/** Settings the app reads, grouped; reported as set or missing, never their values. */
const ENV_GROUPS: { group: string; vars: { name: string; required: boolean; note: string }[] }[] = [
  {
    group: 'Core',
    vars: [
      { name: 'MONGODB_URI', required: true, note: 'Database connection' },
      { name: 'SESSION_SECRET', required: true, note: 'Signs the sign-in cookie' },
      { name: 'KEY_ENCRYPTION_SECRET', required: true, note: 'Encrypts stored AI keys' },
      { name: 'NEXT_PUBLIC_SITE_URL', required: false, note: 'Canonical site address' },
    ],
  },
  {
    group: 'LinkedIn',
    vars: [
      { name: 'LINKEDIN_CLIENT_ID', required: true, note: 'Sign-in and publishing app' },
      { name: 'LINKEDIN_CLIENT_SECRET', required: true, note: 'Sign-in and publishing app' },
      { name: 'LINKEDIN_REDIRECT_URI', required: false, note: 'Sign-in return address' },
      { name: 'LINKEDIN_EXTRA_SCOPES', required: false, note: 'Extra permissions, if granted' },
    ],
  },
  {
    group: 'Background work',
    vars: [
      { name: 'INNGEST_EVENT_KEY', required: false, note: 'Scheduled publishing and jobs' },
      { name: 'INNGEST_SIGNING_KEY', required: false, note: 'Scheduled publishing and jobs' },
      { name: 'CRON_SECRET', required: false, note: 'Protects the cron endpoints' },
    ],
  },
  {
    group: 'Admin panel',
    vars: [
      { name: 'ADMIN_EMAIL', required: true, note: 'Who may sign in here' },
      { name: 'ADMIN_PASSWORD_HASH', required: true, note: 'scrypt hash of the password' },
      { name: 'ADMIN_SESSION_SECRET', required: true, note: 'Signs the admin cookie' },
    ],
  },
];

export async function systemData() {
  await dbConnect();
  const db = await getDb();
  const users = await db
    .collection<{ _id: string; llm?: Record<string, unknown> }>(COLLECTIONS.users)
    .find({}, { projection: { 'llm.anthropicKey': 1, 'llm.openaiKey': 1, 'llm.geminiKey': 1, 'llm.preferredProvider': 1 } })
    .toArray();
  const providers = new Set<string>();
  for (const u of users) {
    if (u.llm?.anthropicKey) providers.add('Anthropic');
    if (u.llm?.openaiKey) providers.add('OpenAI');
    if (u.llm?.geminiKey) providers.add('Google Gemini');
  }
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  const sizes = await Promise.all(
    collections.map(async (c) => ({ name: c.name, count: await db.collection(c.name).estimatedDocumentCount() })),
  );
  return {
    env: ENV_GROUPS.map((g) => ({
      group: g.group,
      vars: g.vars.map((v) => ({ ...v, set: Boolean(process.env[v.name]?.trim()) })),
    })),
    pipelineMode: pipelineMode(),
    adminConfigured: adminConfigured(),
    providers: [...providers],
    users: users.length,
    collections: sizes.sort((a, b) => b.count - a.count),
    runtime: {
      node: process.version,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
      region: process.env.VERCEL_REGION ?? null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      database: mongoose.connection.name || null,
    },
  };
}

/* ── audit ────────────────────────────────────────────────────────────────── */

export async function auditData(): Promise<AdminAuditDoc[]> {
  await dbConnect();
  return listAdminEvents(150);
}

/* ── users ────────────────────────────────────────────────────────────────── */

export async function usersData(now = new Date()): Promise<AppSessionStats> {
  await dbConnect();
  return appSessionStats(now);
}
