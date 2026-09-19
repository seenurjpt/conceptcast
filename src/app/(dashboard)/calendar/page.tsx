'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getJson, sendJson, fmtDate, fmtRelative, toLocalInput } from '@/lib/ui';
import { useSession } from '@/components/SessionProvider';
import { ActionButton, Card, EmptyState, Notice, PageHeader, TrackBadge } from '@/components/ui';

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

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarPage() {
  const { reload: reloadSession } = useSession();
  const [pubs, setPubs] = useState<Pub[]>([]);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const p = await getJson<{ publications: Pub[] }>('/api/publications');
      setPubs(p.publications);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    if (params.get('linkedin') === 'signed-in') {
      setNotice('Signed in with LinkedIn.');
      void reloadSession();
    }
    if (params.get('linkedin') === 'error') setError(`LinkedIn: ${params.get('message')}`);
    if (params.has('linkedin')) window.history.replaceState({}, '', window.location.pathname);
  }, [load, reloadSession]);

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

  const grid = useMemo(() => {
    const first = new Date(month);
    const startOffset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - startOffset);
    const today = new Date().toDateString();
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = date.toDateString();
      return {
        date,
        inMonth: date.getMonth() === month.getMonth(),
        isToday: key === today,
        pubs: pubs.filter((p) => new Date(p.publishedAt ?? p.scheduledFor).toDateString() === key),
      };
    });
  }, [month, pubs]);

  const upcoming = pubs
    .filter((p) => p.status !== 'published')
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  const past = pubs
    .filter((p) => p.status === 'published')
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));

  return (
    <>
      <PageHeader
        title="Published"
        subtitle="What has gone out, and anything you scheduled for later."
        actions={
          <div className="flex items-center gap-1">
            <button
              className="btn btn-quiet btn-sm"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className="w-36 text-center text-[14px] font-semibold">
              {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </span>
            <button
              className="btn btn-quiet btn-sm"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
        }
      />

      <div className="space-y-3">
        {error && <Notice kind="error" onDismiss={() => setError(null)}>{error}</Notice>}
        {notice && <Notice kind="ok" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      </div>

      <div className="card-flush mt-4 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-hairline">
          {DAYS.map((d) => (
            <div key={d} className="label mb-0 px-1.5 py-2 text-center text-[10px] sm:px-3 sm:text-left sm:text-[12px]">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((cell, i) => (
            <div
              key={cell.date.toISOString()}
              className={`min-h-[56px] border-hairline-soft p-1.5 sm:min-h-[92px] sm:p-2 ${i % 7 !== 6 ? 'border-r' : ''} ${i < 35 ? 'border-b' : ''} ${
                cell.inMonth ? '' : 'bg-surface-soft'
              }`}
            >
              <span
                className={`t-number inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] sm:h-6 sm:w-6 sm:text-[12px] ${
                  cell.isToday ? 'bg-primary text-on-primary' : cell.inMonth ? 'text-muted' : 'text-muted-soft'
                }`}
              >
                {cell.date.getDate()}
              </span>
              {cell.pubs.map((p) => (
                <div
                  key={p._id}
                  title={p.hook}
                  className={`mt-1 truncate rounded-[6px] px-1.5 py-1 text-[11px] font-medium ${
                    p.status === 'published'
                      ? 'bg-[color-mix(in_srgb,var(--up)_14%,transparent)] text-up'
                      : p.status === 'failed'
                        ? 'bg-[color-mix(in_srgb,var(--down)_14%,transparent)] text-down'
                        : 'bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-primary'
                  }`}
                >
                  {p.concept?.title ?? 'Untitled'}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <Card title={`Scheduled · ${upcoming.length}`}>
          {loading ? (
            <div className="h-24 animate-pulse rounded-[12px] bg-surface-soft" />
          ) : upcoming.length === 0 ? (
            <p className="t-body-sm text-muted">Nothing scheduled. Approving a draft publishes it straight away unless you pick a time.</p>
          ) : (
            <ul className="row-list">
              {upcoming.map((p) => (
                <ScheduledRow key={p._id} p={p} run={run} />
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Published · ${past.length}`}>
          {past.length === 0 ? (
            <p className="t-body-sm text-muted">Nothing published yet.</p>
          ) : (
            <ul className="row-list">
              {past.map((p) => (
                <li key={p._id} className="row">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="t-title-sm">{p.concept?.title}</span>
                    <TrackBadge track={p.concept?.track} />
                  </div>
                  <p className="post-text t-caption mt-0.5 line-clamp-2 text-body">{p.hook}</p>
                  <p className="t-caption mt-1 text-muted">
                    {fmtRelative(p.publishedAt)} · <span className="t-number text-[12px]">{p.postUrn}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {!loading && pubs.length === 0 && (
        <div className="mt-4">
          <EmptyState title="Nothing on the calendar yet">
            Approve a draft in the review queue and it will appear here, either published straight away or waiting for its slot.
          </EmptyState>
        </div>
      )}
    </>
  );
}

function ScheduledRow({ p, run }: { p: Pub; run: (fn: () => Promise<string | void>) => Promise<void> }) {
  const { session, signInHref } = useSession();
  const [when, setWhen] = useState(toLocalInput(new Date(p.scheduledFor)));
  const dirty = when !== toLocalInput(new Date(p.scheduledFor));

  return (
    <li className="row">
      <div className="flex flex-wrap items-center gap-2">
        <span className="t-title-sm">{p.concept?.title}</span>
        <TrackBadge track={p.concept?.track} />
        <span className={`badge ${p.status === 'failed' ? 'badge-down' : 'badge-primary'}`}>{p.status}</span>
      </div>
      <p className="post-text t-caption mt-0.5 line-clamp-2 text-body">{p.hook}</p>
      <p className="t-caption mt-1 text-muted">{fmtDate(p.scheduledFor)} · {fmtRelative(p.scheduledFor)}</p>
      {p.error && (
        <p className="t-caption mt-1 text-down">
          {p.error} <span className="text-muted">(attempt {p.attempts})</span>
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          className="input h-8 w-auto text-[13px]"
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          aria-label="Reschedule"
        />
        <ActionButton
          className="btn btn-quiet btn-sm"
          disabled={!dirty}
          onClick={() => run(async () => {
            await sendJson(`/api/publications/${p._id}`, 'PATCH', { scheduledFor: new Date(when).toISOString() });
            return 'Rescheduled.';
          })}
        >
          Reschedule
        </ActionButton>
        {session?.signedIn ? (
          <ActionButton
            className="btn btn-sm"
            pendingLabel="Publishing…"
            confirm={{
              title: "Publish to LinkedIn now?",
              body: "This posts to your feed immediately. You can delete it on LinkedIn afterwards, but it will have been visible.",
              confirmLabel: "Publish",
            }}
            onClick={() => run(async () => {
              const r = await sendJson<{ outcome: { status: string; error?: string; postUrn?: string } }>(
                `/api/publications/${p._id}`,
                'POST',
                { action: 'publish-now' },
              );
              if (r.outcome.status === 'published') return `Published: ${r.outcome.postUrn}`;
              throw new Error(r.outcome.error ?? r.outcome.status);
            })}
          >
            Publish now
          </ActionButton>
        ) : (
          <a className="btn btn-sm" href={signInHref()}>
            Sign in to publish
          </a>
        )}
        <ActionButton
          className="btn btn-danger btn-sm"
          confirm={{
            title: "Unschedule this post?",
            body: "It will not publish at the scheduled time. The draft stays approved, so you can schedule it again.",
            confirmLabel: "Unschedule",
            danger: true,
          }}
          onClick={() => run(async () => {
            await sendJson(`/api/publications/${p._id}`, 'DELETE');
            return 'Unscheduled. The draft is still approved.';
          })}
        >
          Unschedule
        </ActionButton>
      </div>
    </li>
  );
}
