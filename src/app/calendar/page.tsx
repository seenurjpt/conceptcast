'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getJson, sendJson, fmtDate, fmtDay, trackClass, toLocalInput } from '@/lib/ui';

interface Pub {
  _id: string;
  status: 'scheduled' | 'publishing' | 'published' | 'failed';
  scheduledFor: string;
  publishedAt: string | null;
  postUrn: string | null;
  error: string | null;
  attempts: number;
  hook: string;
  angle: string | null;
  concept: { slug: string; title: string; track: string } | null;
}
interface AuthStatus {
  state: 'missing' | 'ok' | 'refresh-due' | 'expired' | 'refresh-expired';
  memberName: string | null;
  memberUrn: string | null;
  expiresAt: string | null;
  refreshExpiresAt: string | null;
  scopes: string[];
  source: string | null;
  configured: boolean;
}

export default function CalendarPage() {
  const [pubs, setPubs] = useState<Pub[]>([]);
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([
        getJson<{ publications: Pub[] }>('/api/publications'),
        getJson<AuthStatus>('/api/auth/linkedin/status'),
      ]);
      setPubs(p.publications);
      setAuth(a);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    if (params.get('linkedin') === 'connected') setNotice('LinkedIn connected.');
    if (params.get('linkedin') === 'error') setError(`LinkedIn: ${params.get('message')}`);
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

  const grid = useMemo(() => {
    const first = new Date(month);
    const startOffset = (first.getDay() + 6) % 7; // Monday first
    const start = new Date(first);
    start.setDate(first.getDate() - startOffset);
    const cells: { date: Date; inMonth: boolean; pubs: Pub[] }[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = date.toDateString();
      cells.push({
        date,
        inMonth: date.getMonth() === month.getMonth(),
        pubs: pubs.filter((p) => new Date(p.publishedAt ?? p.scheduledFor).toDateString() === key),
      });
    }
    return cells;
  }, [month, pubs]);

  const upcoming = pubs.filter((p) => p.status === 'scheduled' || p.status === 'failed' || p.status === 'publishing').sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  const past = pubs.filter((p) => p.status === 'published').sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Calendar</h1>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            ‹
          </button>
          <span className="w-36 text-center text-sm font-medium">
            {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </span>
          <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            ›
          </button>
        </div>
      </div>

      {error && <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm">{error}</div>}
      {notice && <div className="rounded-md border border-ok/40 bg-ok/10 px-3 py-2 text-sm">{notice}</div>}

      <div className="panel text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="label mb-0">LinkedIn</span>
            {auth ? (
              <div>
                state <b>{auth.state}</b>
                {auth.memberName && <> · {auth.memberName}</>}
                {auth.memberUrn && <span className="text-muted"> · {auth.memberUrn}</span>}
                {auth.expiresAt && <> · token expires {fmtDay(auth.expiresAt)}</>}
                {auth.refreshExpiresAt && <> · refresh token expires {fmtDay(auth.refreshExpiresAt)}</>}
                {auth.scopes.length > 0 && <span className="text-muted"> · scopes: {auth.scopes.join(' ')}</span>}
                {auth.source === 'env' && <span className="text-muted"> · from env vars</span>}
              </div>
            ) : (
              <div className="text-muted">loading…</div>
            )}
          </div>
          <div className="flex gap-2">
            {auth?.configured && (
              <a className="btn" href="/api/auth/linkedin">
                {auth.state === 'missing' ? 'Connect' : 'Re-authorise'}
              </a>
            )}
            {auth && auth.state !== 'missing' && auth.source !== 'env' && (
              <>
                <button className="btn" disabled={busy !== null} onClick={() => run('refresh', async () => { const r = await sendJson<{ state: string; refreshed: boolean }>('/api/auth/linkedin/status', 'POST'); return r.refreshed ? 'Token refreshed.' : `No refresh needed (${r.state}).`; })}>
                  Refresh token
                </button>
                <button className="btn btn-danger" disabled={busy !== null} onClick={() => { if (window.confirm('Forget the stored LinkedIn tokens?')) void run('disconnect', async () => { await sendJson('/api/auth/linkedin/status', 'DELETE'); return 'Disconnected.'; }); }}>
                  Disconnect
                </button>
              </>
            )}
          </div>
        </div>
        {!auth?.configured && (
          <p className="mt-2 text-muted">
            Set LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET and LINKEDIN_REDIRECT_URI to enable OAuth, or LINKEDIN_ACCESS_TOKEN + LINKEDIN_MEMBER_URN for a token you already have.
          </p>
        )}
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border text-xs">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="bg-panel px-2 py-1 font-semibold text-muted">
            {d}
          </div>
        ))}
        {grid.map((cell) => (
          <div key={cell.date.toISOString()} className={`min-h-[84px] bg-panel p-1 ${cell.inMonth ? '' : 'opacity-40'}`}>
            <div className="text-muted">{cell.date.getDate()}</div>
            {cell.pubs.map((p) => (
              <div
                key={p._id}
                title={p.hook}
                className={`mt-1 truncate rounded px-1 py-0.5 ${
                  p.status === 'published' ? 'bg-ok/15 text-ok' : p.status === 'failed' ? 'bg-danger/15 text-danger' : 'bg-accent-soft text-accent'
                }`}
              >
                {p.concept?.title ?? '?'}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel">
          <span className="label">Scheduled ({upcoming.length})</span>
          <ul className="space-y-3 text-sm">
            {upcoming.length === 0 && <li className="text-muted">Nothing scheduled. Approve a draft in the review queue.</li>}
            {upcoming.map((p) => (
              <ScheduledRow key={p._id} p={p} busy={busy} run={run} />
            ))}
          </ul>
        </div>
        <div className="panel">
          <span className="label">Published ({past.length})</span>
          <ul className="space-y-2 text-sm">
            {past.length === 0 && <li className="text-muted">Nothing published yet.</li>}
            {past.map((p) => (
              <li key={p._id} className="border-t border-border pt-2 first:border-0 first:pt-0">
                <div className="font-medium">
                  {p.concept?.title} <span className={`pill ${trackClass(p.concept?.track ?? '')}`}>{p.concept?.track}</span>
                </div>
                <div className="text-xs text-muted">
                  {fmtDate(p.publishedAt)} · {p.postUrn}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ScheduledRow({ p, busy, run }: { p: Pub; busy: string | null; run: (l: string, fn: () => Promise<string | void>) => Promise<void> }) {
  const [when, setWhen] = useState(toLocalInput(new Date(p.scheduledFor)));
  return (
    <li className="border-t border-border pt-2 first:border-0 first:pt-0">
      <div className="font-medium">
        {p.concept?.title} <span className={`pill ${trackClass(p.concept?.track ?? '')}`}>{p.concept?.track}</span>{' '}
        <span className={`pill ${p.status === 'failed' ? 'text-danger' : ''}`}>{p.status}</span>
      </div>
      <div className="post-text text-xs text-muted">{p.hook}</div>
      {p.error && <div className="text-xs text-danger">{p.error} (attempt {p.attempts})</div>}
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <input className="input w-auto" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <button className="btn" disabled={busy !== null} onClick={() => run('resched', async () => { await sendJson(`/api/publications/${p._id}`, 'PATCH', { scheduledFor: new Date(when).toISOString() }); return 'Rescheduled.'; })}>
          Reschedule
        </button>
        <button className="btn" disabled={busy !== null} onClick={() => { if (window.confirm('Publish to LinkedIn right now?')) void run('now', async () => { const r = await sendJson<{ outcome: { status: string; error?: string; postUrn?: string } }>(`/api/publications/${p._id}`, 'POST', { action: 'publish-now' }); if (r.outcome.status === 'published') return `Published: ${r.outcome.postUrn}`; throw new Error(r.outcome.error ?? r.outcome.status); }); }}>
          Publish now
        </button>
        <button className="btn btn-danger" disabled={busy !== null} onClick={() => run('unsched', async () => { await sendJson(`/api/publications/${p._id}`, 'DELETE'); return 'Unscheduled; the draft stays approved.'; })}>
          Unschedule
        </button>
      </div>
    </li>
  );
}
