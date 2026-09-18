'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getJson, sendJson, fmtRelative } from '@/lib/ui';
import { useSession } from '@/components/SessionProvider';
import { ActionButton, Card, EmptyState, Notice, PageHeader, Stat, TrackBadge } from '@/components/ui';

interface TrackStat {
  track: string;
  posts: number;
  scored: number;
  avgEngagement: number | null;
  avgReactions: number | null;
  avgComments: number | null;
  avgCritic: number | null;
}
interface Pub {
  _id: string;
  status: string;
  publishedAt: string | null;
  postUrn: string | null;
  hook: string;
  angle: string | null;
  criticScore: number | null;
  engagement: number | null;
  concept: { slug: string; title: string; track: string } | null;
  metrics: {
    impressions: number | null;
    reactions: number;
    comments: number;
    shares: number;
    source: string;
    fetchedAt: string;
  } | null;
}

const fmt = (n: number | null, d = 1) => (n === null ? '—' : n.toFixed(d));

export default function AnalyticsPage() {
  const { session } = useSession();
  const [stats, setStats] = useState<TrackStat[]>([]);
  const [pubs, setPubs] = useState<Pub[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await getJson<{ publications: Pub[]; trackStats: TrackStat[] }>('/api/publications');
      setPubs(r.publications.filter((p) => p.status === 'published'));
      setStats(r.trackStats);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<string | void>) => {
    setError(null);
    setNotice(null);
    try {
      const msg = await fn();
      if (msg) setNotice(msg);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const totals = useMemo(() => {
    const scored = pubs.filter((p) => p.metrics);
    return {
      posts: pubs.length,
      scored: scored.length,
      reactions: scored.reduce((s, p) => s + (p.metrics?.reactions ?? 0), 0),
      comments: scored.reduce((s, p) => s + (p.metrics?.comments ?? 0), 0),
    };
  }, [pubs]);

  const best = stats.find((s) => s.avgEngagement !== null);
  const maxEngagement = Math.max(1, ...stats.map((s) => s.avgEngagement ?? 0));

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Engagement feeds the selector and nudges each track's relevance. Score is reactions plus three times comments plus five times shares."
      />

      <div className="space-y-3">
        {error && <Notice kind="error" onDismiss={() => setError(null)}>{error}</Notice>}
        {notice && <Notice kind="ok" onDismiss={() => setNotice(null)}>{notice}</Notice>}
        {!session?.canFetchMetrics && pubs.length > 0 && (
          <Notice kind="attention">
            Automatic metrics need the r_member_social scope. Without it, enter the numbers by hand below. At two posts a
            week that is fine.
          </Notice>
        )}
      </div>

      {loading ? (
        <div className="card mt-4 h-64 animate-pulse" />
      ) : pubs.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Nothing published yet">
            Once posts go out, their engagement lands here and starts steering which concepts the selector picks next.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <Stat label="Posts" value={totals.posts} />
            </Card>
            <Card>
              <Stat label="With metrics" value={totals.scored} />
            </Card>
            <Card>
              <Stat label="Reactions" value={totals.reactions} tone={totals.reactions ? 'up' : undefined} />
            </Card>
            <Card>
              <Stat label="Comments" value={totals.comments} tone={totals.comments ? 'up' : undefined} />
            </Card>
          </div>

          <Card className="mt-4" title="By track">
            {best ? (
              <ul className="row-list">
                {stats.map((s) => (
                  <li key={s.track} className="row flex flex-wrap items-center gap-4">
                    <div className="w-40 shrink-0">
                      <TrackBadge track={s.track} />
                    </div>
                    <div className="h-2 min-w-[80px] flex-1 overflow-hidden rounded-[100px] bg-surface-strong">
                      <div
                        className="h-full rounded-[100px] bg-primary transition-all"
                        style={{ width: `${((s.avgEngagement ?? 0) / maxEngagement) * 100}%` }}
                      />
                    </div>
                    <div className="flex shrink-0 gap-6">
                      <Stat label="Engagement" value={fmt(s.avgEngagement)} />
                      <Stat label="Reactions" value={fmt(s.avgReactions)} />
                      <Stat label="Comments" value={fmt(s.avgComments)} />
                      <Stat label="Critic" value={fmt(s.avgCritic)} />
                      <Stat label="Posts" value={s.posts} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="t-body-sm text-muted">
                No engagement recorded yet. Add numbers to a post below and the per-track view fills in.
              </p>
            )}
          </Card>

          <Card className="mt-4" title="Per post">
            <ul className="row-list">
              {pubs.map((p) => (
                <PostRow key={p._id} p={p} canFetch={session?.canFetchMetrics ?? false} run={run} />
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}

function PostRow({
  p,
  canFetch,
  run,
}: {
  p: Pub;
  canFetch: boolean;
  run: (fn: () => Promise<string | void>) => Promise<void>;
}) {
  const [m, setM] = useState({
    impressions: p.metrics?.impressions?.toString() ?? '',
    reactions: p.metrics?.reactions.toString() ?? '',
    comments: p.metrics?.comments.toString() ?? '',
    shares: p.metrics?.shares.toString() ?? '',
  });
  const set = (k: keyof typeof m) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setM((x) => ({ ...x, [k]: e.target.value }));

  return (
    <li className="row">
      <div className="flex flex-wrap items-center gap-2">
        <span className="t-title-sm">{p.concept?.title}</span>
        <TrackBadge track={p.concept?.track} />
        {p.angle && <span className="badge badge-quiet">{p.angle}</span>}
        {p.engagement !== null && (
          <span className="badge badge-up">
            <span className="t-number text-[12px]">{p.engagement.toFixed(1)}</span> engagement
          </span>
        )}
      </div>
      <p className="post-text t-caption mt-0.5 line-clamp-2 text-body">{p.hook}</p>
      <p className="t-caption mt-1 text-muted">
        {fmtRelative(p.publishedAt)} · critic {p.criticScore ?? '—'}/10
        {p.metrics && ` · ${p.metrics.source} metrics`}
      </p>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        {(['impressions', 'reactions', 'comments', 'shares'] as const).map((k) => (
          <div key={k}>
            <label className="label" htmlFor={`${k}-${p._id}`}>
              {k}
            </label>
            <input
              id={`${k}-${p._id}`}
              className="input t-number h-8 w-24 px-2 text-[13px]"
              type="number"
              min={0}
              value={m[k]}
              onChange={set(k)}
            />
          </div>
        ))}
        <ActionButton
          className="btn btn-sm"
          disabled={m.reactions === '' || m.comments === ''}
          onClick={() =>
            run(async () => {
              const r = await sendJson<{ feedbackDelta: number }>(`/api/publications/${p._id}`, 'PATCH', {
                metrics: {
                  impressions: m.impressions === '' ? null : Number(m.impressions),
                  reactions: Number(m.reactions),
                  comments: Number(m.comments),
                  shares: m.shares === '' ? 0 : Number(m.shares),
                },
              });
              return r.feedbackDelta
                ? `Saved. Track relevance nudged by ${r.feedbackDelta > 0 ? '+' : ''}${r.feedbackDelta.toFixed(2)}.`
                : 'Saved. The feedback nudge needs at least three scored posts.';
            })
          }
        >
          Save
        </ActionButton>
        {canFetch && (
          <ActionButton
            className="btn btn-quiet btn-sm"
            pendingLabel="Fetching…"
            onClick={() =>
              run(async () => {
                const r = await sendJson<{ outcome: { ok: boolean; reason?: string } }>(
                  `/api/publications/${p._id}`,
                  'POST',
                  { action: 'fetch-metrics' },
                );
                return r.outcome.ok ? 'Fetched from LinkedIn.' : `Not fetched: ${r.outcome.reason}`;
              })
            }
          >
            Fetch
          </ActionButton>
        )}
      </div>
    </li>
  );
}
