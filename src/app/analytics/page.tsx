'use client';

import { useCallback, useEffect, useState } from 'react';
import { getJson, sendJson, fmtDay, trackClass } from '@/lib/ui';

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
  metrics: { impressions: number | null; reactions: number; comments: number; shares: number; source: string; fetchedAt: string } | null;
}

const fmt = (n: number | null, d = 1) => (n === null ? '—' : n.toFixed(d));

export default function AnalyticsPage() {
  const [stats, setStats] = useState<TrackStat[]>([]);
  const [pubs, setPubs] = useState<Pub[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await getJson<{ publications: Pub[]; trackStats: TrackStat[] }>('/api/publications');
      setPubs(r.publications.filter((p) => p.status === 'published'));
      setStats(r.trackStats);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (label: string, fn: () => Promise<string | void>) => {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const msg = await fn();
      if (msg) setNotice(msg);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Analytics</h1>
        <p className="text-sm text-muted">
          Engagement by track feeds the selector (last 10 posts) and nudges each track&apos;s relevance. Engagement score = reactions + 3×comments +
          5×shares + impressions/200. No <code>r_member_social</code>? Enter numbers by hand 48h after posting.
        </p>
      </div>
      {error && <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm">{error}</div>}
      {notice && <div className="rounded-md border border-ok/40 bg-ok/10 px-3 py-2 text-sm">{notice}</div>}

      <div className="panel overflow-x-auto">
        <span className="label">By track</span>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-1">track</th>
              <th>posts</th>
              <th>with metrics</th>
              <th>avg engagement</th>
              <th>avg reactions</th>
              <th>avg comments</th>
              <th>avg critic score</th>
            </tr>
          </thead>
          <tbody>
            {stats.length === 0 && (
              <tr>
                <td colSpan={7} className="py-3 text-muted">
                  Nothing published yet.
                </td>
              </tr>
            )}
            {stats.map((s) => (
              <tr key={s.track} className="border-t border-border">
                <td className="py-1">
                  <span className={`pill ${trackClass(s.track)}`}>{s.track}</span>
                </td>
                <td>{s.posts}</td>
                <td>{s.scored}</td>
                <td className="font-semibold">{fmt(s.avgEngagement)}</td>
                <td>{fmt(s.avgReactions)}</td>
                <td>{fmt(s.avgComments)}</td>
                <td>{fmt(s.avgCritic)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <span className="label">Per post</span>
        <ul className="space-y-3 text-sm">
          {pubs.length === 0 && <li className="text-muted">Nothing published yet.</li>}
          {pubs.map((p) => (
            <PostRow key={p._id} p={p} busy={busy} run={run} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function PostRow({ p, busy, run }: { p: Pub; busy: string | null; run: (l: string, fn: () => Promise<string | void>) => Promise<void> }) {
  const [m, setM] = useState({
    impressions: p.metrics?.impressions?.toString() ?? '',
    reactions: p.metrics?.reactions.toString() ?? '',
    comments: p.metrics?.comments.toString() ?? '',
    shares: p.metrics?.shares.toString() ?? '',
  });
  const set = (k: keyof typeof m) => (e: React.ChangeEvent<HTMLInputElement>) => setM((x) => ({ ...x, [k]: e.target.value }));

  return (
    <li className="border-t border-border pt-3 first:border-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{p.concept?.title}</span>
        <span className={`pill ${trackClass(p.concept?.track ?? '')}`}>{p.concept?.track}</span>
        {p.angle && <span className="pill">{p.angle}</span>}
        <span className="text-xs text-muted">
          {fmtDay(p.publishedAt)} · critic {p.criticScore ?? '—'}/10
          {p.engagement !== null && (
            <>
              {' '}
              · engagement <b>{p.engagement.toFixed(1)}</b> ({p.metrics?.source})
            </>
          )}
        </span>
      </div>
      <div className="post-text text-xs text-muted">{p.hook}</div>
      <div className="mt-1 flex flex-wrap items-end gap-2">
        {(['impressions', 'reactions', 'comments', 'shares'] as const).map((k) => (
          <label key={k} className="text-xs text-muted">
            {k}
            <input className="input mt-0.5 w-24" type="number" min={0} value={m[k]} onChange={set(k)} />
          </label>
        ))}
        <button
          className="btn"
          disabled={busy !== null || m.reactions === '' || m.comments === ''}
          onClick={() =>
            run(`save-${p._id}`, async () => {
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
                : 'Saved. (Feedback nudge needs at least 3 scored posts.)';
            })
          }
        >
          Save metrics
        </button>
        <button className="btn" disabled={busy !== null} onClick={() => run(`fetch-${p._id}`, async () => { const r = await sendJson<{ outcome: { ok: boolean; reason?: string } }>(`/api/publications/${p._id}`, 'POST', { action: 'fetch-metrics' }); return r.outcome.ok ? 'Fetched from LinkedIn.' : `Not fetched: ${r.outcome.reason}`; })}>
          Fetch from LinkedIn
        </button>
      </div>
    </li>
  );
}
