'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getJson, fmtRelative, fmtDate } from '@/lib/ui';
import { Notice, ScoreBadge } from '@/components/ui';
import { AreaChart } from '@/components/AreaChart';

/**
 * The signed-in home: where things stand, and the one or two things worth
 * doing next. Reads a single endpoint (/api/dashboard); the chart's range
 * switch re-reads it with ?weeks=.
 *
 * Layout, top to bottom: a greeting band with a one-line summary and the
 * primary actions; a setup checklist (only until setup is done); four stat
 * tiles, each a link to its page; activity next to quality and reach; the
 * review queue next to topic progress; recently published next to what is
 * scheduled.
 */

type Provider = 'anthropic' | 'openai' | 'gemini';
interface Row {
  _id: string;
  title: string;
  topic: string | null;
}
interface Dashboard {
  member: { name: string | null };
  setup: { aiKey: boolean; linkedin: boolean; voice: boolean; topic: boolean; firstPost: boolean };
  stats: {
    published: number;
    publishedThisMonth: number;
    pending: number;
    oldestPendingAt: string | null;
    toWrite: number;
    activeTopics: number;
    spendUsd: number;
    calls: number;
    providers: Provider[];
    avgScore: number | null;
    scoredDrafts: number;
    engagement: { reactions: number; comments: number; shares: number };
    measuredPosts: number;
  };
  weeks: { start: string; drafts: number }[];
  range: { weeks: number; previousTotal: number };
  pending: (Row & { score: number | null; passed: boolean | null; angle: string | null; createdAt: string })[];
  topics: { _id: string; title: string; published: number; inFlight: number; toWrite: number; total: number }[];
  upcoming: (Row & { scheduledFor: string })[];
  recent: (Row & {
    publishedAt: string | null;
    postUrn: string | null;
    metrics: { reactions: number; comments: number; shares: number } | null;
  })[];
}

const PROVIDER_LABEL: Record<Provider, string> = { anthropic: 'Anthropic', openai: 'OpenAI', gemini: 'Gemini' };
const RANGES: { weeks: number; label: string; long: string }[] = [
  { weeks: 8, label: '8W', long: 'last 8 weeks' },
  { weeks: 12, label: '12W', long: 'last 12 weeks' },
  { weeks: 26, label: '6M', long: 'last 6 months' },
];

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function money(usd: number): string {
  if (usd === 0) return '$0';
  return usd < 0.01 ? '<$0.01' : `$${usd.toFixed(2)}`;
}

const s = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weeks, setWeeks] = useState(8);
  const [chartLoading, setChartLoading] = useState(false);

  const load = useCallback(async (w: number) => {
    try {
      setData(await getJson<Dashboard>(`/api/dashboard?weeks=${w}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChartLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(8);
  }, [load]);

  if (error) return <Notice kind="error">{error}</Notice>;
  if (!data) return <DashboardSkeleton />;

  const { stats, setup } = data;
  const firstName = data.member.name?.split(' ')[0];

  const summary: string[] = [];
  if (stats.pending) summary.push(`${s(stats.pending, 'draft')} waiting for your review`);
  if (stats.toWrite) summary.push(`${s(stats.toWrite, 'subtopic')} left across ${s(stats.activeTopics, 'topic')}`);
  if (!summary.length) summary.push('Everything is up to date. Pick a subtopic when you are ready to write.');

  const setupItems = [
    { done: setup.aiKey, label: 'Add an AI key', href: '/settings', hint: 'Anthropic, OpenAI or a free Gemini key' },
    { done: setup.linkedin, label: 'Connect LinkedIn', href: '/settings', hint: 'So approved posts can be published' },
    { done: setup.voice, label: 'Set your voice', href: '/voice', hint: 'Paste a few of your own posts' },
    { done: setup.topic, label: 'Start a topic', href: '/backlog', hint: 'Name something you are learning' },
    { done: setup.firstPost, label: 'Publish your first post', href: '/review', hint: 'Approve a draft you like' },
  ];
  const setupDone = setupItems.filter((x) => x.done).length;

  const total = data.weeks.reduce((n, w) => n + w.drafts, 0);
  const prev = data.range.previousTotal;
  const delta = prev === 0 ? (total > 0 ? null : 0) : Math.round(((total - prev) / prev) * 100);
  const rangeInfo = RANGES.find((r) => r.weeks === data.range.weeks) ?? RANGES[0];

  return (
    <div className="space-y-6">
      {/* ── greeting band ── */}
      <section className="dash-hero">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="mt-1 text-[clamp(24px,3vw,32px)] font-semibold leading-tight tracking-[-0.03em]">
            {firstName ? `${greeting()}, ${firstName}` : greeting()}
          </h1>
          <p className="mt-1.5 text-[14px] text-body">{summary.join(' · ')}</p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          {stats.pending > 0 && (
            <Link href="/review" className="btn">
              Review drafts
              <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-[18px] text-on-primary">
                {stats.pending}
              </span>
            </Link>
          )}
          <Link href="/backlog" className="btn btn-primary">
            <Icon name="pen" />
            Write a post
          </Link>
        </div>
      </section>

      {/* ── setup ── */}
      {setupDone < setupItems.length && (
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">Finish setting up</h2>
              <p className="text-[13px] text-muted">
                {setupItems.length - setupDone} step{setupItems.length - setupDone === 1 ? '' : 's'} left before conceptcast
                runs at its best.
              </p>
            </div>
            <span className="font-mono text-[12px] tabular-nums text-muted">
              {setupDone}/{setupItems.length}
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-strong)]">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(setupDone / setupItems.length) * 100}%` }} />
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {setupItems.map((x) => (
              <li key={x.label}>
                <Link
                  href={x.href}
                  className={`setup-item flex h-full items-start gap-2.5 rounded-[12px] border px-3 py-2.5${x.done ? ' is-done' : ''}`}
                >
                  <span
                    aria-hidden
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      x.done ? 'border-[var(--up)] bg-[var(--up)] text-white' : 'border-[var(--muted-soft)]'
                    }`}
                  >
                    {x.done && (
                      <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[13px] font-semibold leading-snug ${x.done ? 'line-through' : ''}`}>
                      {x.label}
                      <span className="sr-only">{x.done ? ' (done)' : ' (to do)'}</span>
                    </span>
                    <span className="block text-[12px] leading-snug text-muted">{x.hint}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── headline numbers ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatTile href="/calendar" icon="send" label="Posts published" value={String(stats.published)} note={`${stats.publishedThisMonth} this month`} />
        <StatTile
          href="/review"
          icon="inbox"
          label="Awaiting review"
          value={String(stats.pending)}
          note={stats.oldestPendingAt ? `Oldest ${fmtRelative(stats.oldestPendingAt)}` : 'Queue is clear'}
          highlight={stats.pending > 0}
        />
        <StatTile
          href="/backlog"
          icon="list"
          label="Subtopics to write"
          value={String(stats.toWrite)}
          note={`Across ${s(stats.activeTopics, 'topic')}`}
        />
        <StatTile
          href="/settings"
          icon="spark"
          label="AI spend this month"
          value={money(stats.spendUsd)}
          note={
            stats.providers.length
              ? `${s(stats.calls, 'call')} · ${stats.providers.map((p) => PROVIDER_LABEL[p]).join(', ')}`
              : 'No AI key yet'
          }
        />
      </div>

      {/* ── activity + quality ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card min-w-0 lg:col-span-2" aria-labelledby="activity-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="activity-title" className="label mb-0">
                Drafts written
              </h2>
              <div className="mt-1.5 flex items-baseline gap-2.5">
                <span className="font-mono text-[28px] font-semibold leading-none tabular-nums">{total}</span>
                <span className="text-[13px] text-muted">{rangeInfo.long}</span>
                <DeltaPill delta={delta} />
              </div>
            </div>
            <div role="group" aria-label="Chart range" className="range-toggle">
              {RANGES.map((r) => (
                <button
                  key={r.weeks}
                  type="button"
                  aria-pressed={weeks === r.weeks}
                  onClick={() => {
                    if (weeks === r.weeks) return;
                    setWeeks(r.weeks);
                    setChartLoading(true);
                    void load(r.weeks);
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className={`mt-5 transition-opacity ${chartLoading ? 'opacity-40' : ''}`} key={data.range.weeks}>
            {total === 0 && prev === 0 ? (
              <p className="py-16 text-center text-[13px] text-muted">
                No drafts yet in this period. Pick a subtopic and click Write a post to start.
              </p>
            ) : (
              <AreaChart
                data={data.weeks.map((w) => ({ start: w.start, value: w.drafts }))}
                unit={['draft', 'drafts']}
                caption={`Drafts written per week, ${rangeInfo.long}`}
              />
            )}
          </div>
        </section>

        <section className="card min-w-0" aria-labelledby="quality-title">
          <h2 id="quality-title" className="label mb-0">
            Quality and reach
          </h2>
          <div className="mt-4 flex items-center gap-5">
            <ScoreRing value={stats.avgScore} />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold">Average critic score</p>
              <p className="mt-0.5 text-[12px] leading-snug text-muted">
                {stats.scoredDrafts
                  ? `Across ${s(stats.scoredDrafts, 'draft')} in the last 8 weeks. 7 and up is publishable.`
                  : 'No scored drafts yet.'}
              </p>
            </div>
          </div>
          <div className="mt-5 border-t border-hairline pt-4">
            <p className="text-[13px] font-semibold">Engagement on published posts</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(
                [
                  ['Reactions', stats.engagement.reactions, 'heart'],
                  ['Comments', stats.engagement.comments, 'chat'],
                  ['Shares', stats.engagement.shares, 'share'],
                ] as const
              ).map(([k, v, icon]) => (
                <div key={k} className="rounded-[14px] bg-[var(--surface-soft)] px-2 py-3 text-center">
                  <span className="mx-auto flex h-6 w-6 items-center justify-center text-muted">
                    <Icon name={icon} />
                  </span>
                  <p className="mt-1 font-mono text-[18px] font-semibold tabular-nums">{v}</p>
                  <p className="text-[11px] text-muted">{k}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-muted">
              {stats.measuredPosts ? `Measured on ${s(stats.measuredPosts, 'post')}. ` : 'No numbers yet. '}
              <Link href="/analytics" className="font-medium text-primary hover:underline">
                Open analytics
              </Link>
            </p>
          </div>
        </section>
      </div>

      {/* ── review queue + topics ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Awaiting your review" action={stats.pending > 0 ? { href: '/review', label: 'Open queue' } : undefined}>
          {data.pending.length === 0 ? (
            <EmptyLine>Nothing waiting. New drafts land here for your approval.</EmptyLine>
          ) : (
            <ul className="divide-y divide-hairline">
              {data.pending.map((d) => (
                <li key={d._id}>
                  <Link href={`/review?draft=${d._id}`} className="dash-row">
                    <span className="dash-row-icon">
                      <Icon name="doc" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{d.title}</span>
                      <span className="block truncate text-[12px] text-muted">
                        {[d.topic, d.angle, fmtRelative(d.createdAt)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {d.score !== null && <ScoreBadge score={d.score} passed={d.passed ?? undefined} />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Your topics" action={{ href: '/backlog', label: 'All topics' }}>
          {data.topics.length === 0 ? (
            <EmptyLine>
              No topics yet.{' '}
              <Link href="/backlog" className="text-primary hover:underline">
                Start one
              </Link>{' '}
              and get ten subtopics suggested.
            </EmptyLine>
          ) : (
            <ul className="space-y-1">
              {data.topics.map((t) => {
                const pub = t.total ? (t.published / t.total) * 100 : 0;
                const fly = t.total ? (t.inFlight / t.total) * 100 : 0;
                return (
                  <li key={t._id}>
                    <Link href={`/backlog/${t._id}`} className="dash-topic">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[14px] font-semibold">{t.title}</span>
                        <span className="shrink-0 font-mono text-[12px] tabular-nums text-muted">
                          {t.published}/{t.total}
                        </span>
                      </div>
                      <div
                        className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full bg-[var(--surface-strong)]"
                        role="img"
                        aria-label={`${t.title}: ${t.published} published, ${t.inFlight} in progress, ${t.toWrite} to write`}
                      >
                        {pub > 0 && <span className="h-full rounded-full bg-primary" style={{ width: `${Math.max(pub, 3)}%` }} />}
                        {fly > 0 && <span className="h-full rounded-full bg-primary/35" style={{ width: `${Math.max(fly, 3)}%` }} />}
                      </div>
                      <p className="mt-1.5 flex flex-wrap gap-x-3 text-[12px] text-muted">
                        <span>
                          <span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-full bg-primary align-middle" />
                          {t.published} published
                        </span>
                        {t.inFlight > 0 && (
                          <span>
                            <span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-full bg-primary/35 align-middle" />
                            {t.inFlight} in progress
                          </span>
                        )}
                        <span>{t.toWrite} to write</span>
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {/* ── published + scheduled ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Recently published" className="lg:col-span-2" action={{ href: '/calendar', label: 'All posts' }}>
          {data.recent.length === 0 ? (
            <EmptyLine>Nothing published yet. Approve a draft to post it to LinkedIn.</EmptyLine>
          ) : (
            <ul className="divide-y divide-hairline">
              {data.recent.map((p) => (
                <li key={p._id} className="dash-row">
                  <span className="dash-row-icon is-linkedin">
                    <Icon name="linkedin" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{p.title}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {[p.topic, p.publishedAt ? fmtRelative(p.publishedAt) : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {p.metrics ? (
                    <span className="hidden shrink-0 items-center gap-3 font-mono text-[12px] tabular-nums text-muted sm:flex">
                      <span>{p.metrics.reactions} reactions</span>
                      <span>{p.metrics.comments} comments</span>
                    </span>
                  ) : (
                    <span className="hidden shrink-0 text-[12px] text-muted sm:inline">No metrics yet</span>
                  )}
                  {p.postUrn && (
                    <a
                      href={`https://www.linkedin.com/feed/update/${p.postUrn}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm shrink-0"
                    >
                      View<span className="sr-only"> on LinkedIn (opens in a new tab)</span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Up next">
          {data.upcoming.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <span className="dash-row-icon">
                <Icon name="calendar" />
              </span>
              <p className="mt-2 text-[13px] font-semibold">Nothing scheduled</p>
              <p className="text-[12px] text-muted">Schedule a draft when you approve it.</p>
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {data.upcoming.map((p) => (
                <li key={p._id} className="dash-row">
                  <span className="dash-row-icon">
                    <Icon name="calendar" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{p.title}</span>
                    <span className="block text-[12px] text-muted">{fmtDate(p.scheduledFor)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ── pieces ─────────────────────────────────────────────────────────────── */

function Panel({
  title,
  action,
  className = '',
  children,
}: {
  title: string;
  action?: { href: string; label: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`card min-w-0 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {action && (
          <Link href={action.href} className="btn-text text-[12px]">
            {action.label}
            <span aria-hidden> →</span>
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-[13px] text-muted">{children}</p>;
}

function StatTile({
  href,
  icon,
  label,
  value,
  note,
  highlight = false,
}: {
  href: string;
  icon: IconName;
  label: string;
  value: string;
  note: string;
  highlight?: boolean;
}) {
  return (
    <Link href={href} className={`card stat-tile block min-w-0${highlight ? ' is-highlight' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium leading-snug text-muted">{label}</p>
        <span className="dash-icon">
          <Icon name={icon} />
        </span>
      </div>
      <p className="mt-3 font-mono text-[30px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{value}</p>
      <p className="mt-2 truncate text-[12px] text-muted">{note}</p>
    </Link>
  );
}

/** Change against the previous period of the same length. */
function DeltaPill({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="delta-pill is-up">New</span>;
  if (delta === 0) return <span className="delta-pill">No change</span>;
  const up = delta > 0;
  return (
    <span className={`delta-pill ${up ? 'is-up' : 'is-down'}`}>
      <span aria-hidden>{up ? '↑' : '↓'}</span> {Math.abs(delta)}%<span className="sr-only"> versus the previous period</span>
    </span>
  );
}

/** The average critic score as a ring out of 10. */
function ScoreRing({ value }: { value: number | null }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const frac = value === null ? 0 : Math.min(1, Math.max(0, value / 10));
  return (
    <div className="relative h-[84px] w-[84px] shrink-0" role="img" aria-label={value === null ? 'No score yet' : `Average critic score ${value.toFixed(1)} out of 10`}>
      <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden className="-rotate-90">
        <circle cx="42" cy="42" r={r} fill="none" stroke="var(--surface-strong)" strokeWidth="8" />
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`}
          className="score-ring"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[20px] font-semibold leading-none tabular-nums">{value === null ? '-' : value.toFixed(1)}</span>
        <span className="text-[10px] text-muted">of 10</span>
      </span>
    </div>
  );
}

type IconName =
  | 'send'
  | 'inbox'
  | 'list'
  | 'spark'
  | 'pen'
  | 'doc'
  | 'calendar'
  | 'linkedin'
  | 'heart'
  | 'chat'
  | 'share';

/** Small stroke icons, drawn at 16px in the current text colour. */
function Icon({ name }: { name: IconName }) {
  if (name === 'linkedin') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.55V9h3.57v11.45z" />
      </svg>
    );
  }
  const paths: Record<Exclude<IconName, 'linkedin'>, React.ReactNode> = {
    send: <path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z" />,
    inbox: (
      <>
        <path d="M3 13h5l1.5 3h5L16 13h5" />
        <path d="M5.5 5h13L21 13v6H3v-6l2.5-8Z" />
      </>
    ),
    list: <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />,
    spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />,
    pen: <path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" />,
    doc: (
      <>
        <path d="M14 3H6v18h12V7l-4-4Z" />
        <path d="M14 3v4h4M9 12h6M9 16h6" />
      </>
    ),
    calendar: (
      <>
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </>
    ),
    heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />,
    chat: <path d="M4 5h16v11H9l-5 4V5Z" />,
    share: (
      <>
        <circle cx="18" cy="5.5" r="2.5" />
        <circle cx="6" cy="12" r="2.5" />
        <circle cx="18" cy="18.5" r="2.5" />
        <path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" />
      </>
    ),
  };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="dash-hero h-[124px] animate-pulse" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-[124px] animate-pulse" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card h-[340px] animate-pulse lg:col-span-2" />
        <div className="card h-[340px] animate-pulse" />
      </div>
    </div>
  );
}
