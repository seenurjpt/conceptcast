'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getJson, sendJson, fmtRelative, fmtDate, toLocalInput, LINKEDIN_FOLD } from '@/lib/ui';
import { checkHardConstraints, MIN_CHARS, MAX_CHARS } from '@/lib/pipeline/constraints';
import { useSession } from '@/components/SessionProvider';
import {
  ActionButton,
  CharMeter,
  Card,
  EmptyState,
  Notice,
  PageHeader,
  ScoreBadge,
  Segmented,
  TrackBadge,
} from '@/components/ui';

type Status = 'pending' | 'approved' | 'published' | 'rejected';
const ANGLES = ['mechanism', 'misconception', 'tradeoff', 'debug-story'] as const;

interface ConceptLite {
  _id: string;
  slug: string;
  title: string;
  track: string;
  oneLiner: string;
  focus: string;
  status: string;
  primarySources: { type: string; url: string; title: string }[];
}
interface DraftRow {
  _id: string;
  angle: string;
  hook: string;
  body: string;
  charCount: number;
  version: number;
  status: Status;
  editedByHuman: boolean;
  rejectionReason: string | null;
  createdAt: string;
  critique: { score: number; issues: string[]; strengths: string[]; depthPassed: boolean; revisionOf: string | null };
  concept: ConceptLite | null;
  publication: { _id: string; status: string; scheduledFor: string; postUrn: string | null; error: string | null } | null;
}
interface Research {
  mechanism: string;
  facts: { text: string; sourceUrl: string; sourceTitle: string | null; type: string; confidence: string }[];
  misconceptions: { belief: string; reality: string; sourceUrl: string }[];
  codeExample: { language: string; snippet: string; explanation: string } | null;
  devImplication: string;
  analogyCandidates: string[];
  resolvedSources: { url: string; chars: number; truncated: boolean }[];
}
interface DraftDetail {
  draft: DraftRow;
  concept: ConceptLite | null;
  research: Research | null;
  previous: DraftRow | null;
  publication: DraftRow['publication'];
  constraintViolations: string[];
}

export default function ReviewPage() {
  const [tab, setTab] = useState<Status>('pending');
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DraftDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCounts = useCallback(async () => {
    try {
      const { drafts } = await getJson<{ drafts: DraftRow[] }>('/api/drafts?status=all');
      const c: Record<string, number> = {};
      for (const d of drafts) c[d.status] = (c[d.status] ?? 0) + 1;
      setCounts(c);
    } catch {
      /* counts are decoration; a failure here should not block the queue */
    }
  }, []);

  const loadList = useCallback(async () => {
    try {
      const { drafts } = await getJson<{ drafts: DraftRow[] }>(`/api/drafts?status=${tab}`);
      setRows(drafts);
      setSelectedId((cur) => (cur && drafts.some((d) => d._id === cur) ? cur : (drafts[0]?._id ?? null)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  const loadDetail = useCallback(async (id: string) => {
    try {
      setDetail(await getJson<DraftDetail>(`/api/drafts/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void loadList();
    void loadCounts();
  }, [loadList, loadCounts]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const run = async (fn: () => Promise<string | void>) => {
    setError(null);
    setNotice(null);
    try {
      const msg = await fn();
      if (msg) setNotice(msg);
      await Promise.all([loadList(), loadCounts()]);
      if (selectedId) await loadDetail(selectedId);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <PageHeader
        title="Review queue"
        subtitle="Every claim carries a source. Open them before you approve — your name goes on this."
        actions={
          <Segmented
            value={tab}
            onChange={(v) => {
              setTab(v);
              setLoading(true);
            }}
            options={[
              { value: 'pending', label: 'Pending', count: counts.pending ?? 0 },
              { value: 'approved', label: 'Approved', count: counts.approved ?? 0 },
              { value: 'published', label: 'Published', count: counts.published ?? 0 },
              { value: 'rejected', label: 'Rejected', count: counts.rejected ?? 0 },
            ]}
          />
        }
      />

      <div className="space-y-3">
        {error && <Notice kind="error" onDismiss={() => setError(null)}>{error}</Notice>}
        {notice && <Notice kind="ok" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      </div>

      {loading ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[300px_1fr]">
          <div className="card h-24 animate-pulse" />
          <div className="card h-96 animate-pulse" />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState title={`Nothing ${tab}`}>
            {tab === 'pending' ? (
              <>
                Generate a draft from the Backlog screen, or run <code className="t-number text-[13px]">npm run draft -- prompt-caching</code> in your terminal.
              </>
            ) : (
              <>Drafts you {tab === 'rejected' ? 'reject' : tab} will appear here.</>
            )}
          </EmptyState>
        </div>
      ) : (
        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[300px_1fr]">
          <ul className="space-y-2">
            {rows.map((d) => (
              <li key={d._id}>
                <button
                  onClick={() => setSelectedId(d._id)}
                  className={`card card-hover w-full p-4 text-left ${selectedId === d._id ? 'card-selected' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="t-title-sm min-w-0 flex-1 truncate">{d.concept?.title ?? 'Unknown'}</span>
                    <ScoreBadge score={d.critique.score} passed={d.critique.depthPassed} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <TrackBadge track={d.concept?.track} />
                    <span className="badge badge-quiet">{d.angle}</span>
                    {d.editedByHuman && <span className="badge badge-quiet">edited</span>}
                  </div>
                  <div className="t-caption mt-2 text-muted">
                    <span className="t-number text-[13px]">{d.charCount}</span> chars · {fmtRelative(d.createdAt)}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {detail && <DraftPanel key={detail.draft._id} detail={detail} run={run} />}
        </div>
      )}
    </>
  );
}

function DraftPanel({ detail, run }: { detail: DraftDetail; run: (fn: () => Promise<string | void>) => Promise<void> }) {
  const { draft, concept, research, previous, publication } = detail;
  const { session } = useSession();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(draft.body);
  const [readToEnd, setReadToEnd] = useState(false);
  const [when, setWhen] = useState('');
  const [angle, setAngle] = useState<(typeof ANGLES)[number]>('mechanism');
  const [pane, setPane] = useState<'draft' | 'research' | 'critique'>('draft');
  const scrollRef = useRef<HTMLDivElement>(null);

  const violations = useMemo(() => checkHardConstraints(body), [body]);
  const dirty = body !== draft.body;
  const canDecide = draft.status === 'pending' || draft.status === 'approved';
  const canPublish = session?.signedIn ?? false;

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setReadToEnd(true);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 4) setReadToEnd(true);
  }, [body, editing, pane]);

  const sources = useMemo(() => {
    const map = new Map<string, { url: string; title: string | null; resolved: boolean | null; facts: number }>();
    for (const s of concept?.primarySources ?? []) {
      const r = research?.resolvedSources.find((x) => x.url === s.url);
      map.set(s.url, { url: s.url, title: s.title, resolved: research ? Boolean(r) : null, facts: 0 });
    }
    for (const f of research?.facts ?? []) {
      const cur = map.get(f.sourceUrl) ?? { url: f.sourceUrl, title: f.sourceTitle, resolved: null, facts: 0 };
      cur.facts += 1;
      map.set(f.sourceUrl, cur);
    }
    return [...map.values()];
  }, [concept, research]);

  const approveBlocker = !canDecide
    ? null
    : dirty
      ? 'Save or discard your edit first.'
      : !readToEnd
        ? 'Scroll to the end of the draft to enable approving.'
        : !canPublish && !when
          ? 'Sign in with LinkedIn to publish now, or pick a time to schedule it.'
          : null;

  return (
    <div className="min-w-0 space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="t-title">{concept?.title ?? 'Unknown concept'}</h2>
            <p className="t-body-sm mt-0.5 text-body">{concept?.oneLiner}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <TrackBadge track={concept?.track} />
            <span className="badge badge-quiet">{draft.angle}</span>
            <span className="badge badge-quiet">v{draft.version}</span>
            <ScoreBadge score={draft.critique.score} passed={draft.critique.depthPassed} />
          </div>
        </div>

        {publication && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hairline pt-3 text-[13px]">
            <span>
              <span className="text-muted">Publication </span>
              <span className={`font-semibold ${publication.status === 'published' ? 'text-up' : publication.status === 'failed' ? 'text-down' : ''}`}>
                {publication.status}
              </span>
            </span>
            <span className="text-muted">{fmtDate(publication.scheduledFor)}</span>
            {publication.postUrn && <span className="t-number text-[12px] text-muted">{publication.postUrn}</span>}
            {publication.error && <span className="text-down">{publication.error}</span>}
          </div>
        )}
        {draft.rejectionReason && (
          <p className="mt-3 border-t border-hairline pt-3 text-[13px] text-down">Rejected: {draft.rejectionReason}</p>
        )}
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="card-flush">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-5 py-3">
              <Segmented
                value={pane}
                onChange={setPane}
                options={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'research', label: 'Research', count: research?.facts.length },
                  { value: 'critique', label: 'Critique', count: draft.critique.issues.length },
                ]}
              />
              {pane === 'draft' && (
                <div className="flex items-center gap-3">
                  <CharMeter count={body.length} min={MIN_CHARS} max={MAX_CHARS} />
                  {canDecide && !editing && (
                    <button className="btn btn-quiet btn-sm" onClick={() => setEditing(true)}>
                      Edit
                    </button>
                  )}
                </div>
              )}
            </div>

            {pane === 'draft' && (
              <div className="p-5">
                {editing ? (
                  <textarea
                    className="input w-full min-h-[440px]"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    autoFocus
                  />
                ) : (
                  <div ref={scrollRef} onScroll={checkScroll} className="scroll-slim post-text max-h-[520px] overflow-y-auto pr-2">
                    {body}
                  </div>
                )}

                {violations.length > 0 && (
                  <ul className="mt-4 space-y-1 rounded-[12px] border border-[color-mix(in_srgb,var(--attention)_35%,transparent)] bg-[color-mix(in_srgb,var(--attention)_8%,transparent)] p-3 text-[13px]">
                    {violations.map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                )}

                <div className={`flex flex-wrap gap-2 ${editing ? 'mt-4' : ''}`}>
                  {editing && (
                    <>
                      <ActionButton
                        className="btn btn-primary btn-sm"
                        disabled={!dirty}
                        pendingLabel="Saving…"
                        onClick={() =>
                          run(async () => {
                            await sendJson(`/api/drafts/${draft._id}`, 'PATCH', { body });
                            setEditing(false);
                            setReadToEnd(false);
                            return 'Saved your edit.';
                          })
                        }
                      >
                        Save
                      </ActionButton>
                      <button
                        className="btn btn-quiet btn-sm"
                        onClick={() => {
                          setBody(draft.body);
                          setEditing(false);
                        }}
                      >
                        Discard
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {pane === 'research' &&
              (research ? (
                <div className="space-y-5 p-5 text-[14px]">
                  <section>
                    <h3 className="label">Mechanism</h3>
                    <p className="post-text">{research.mechanism}</p>
                  </section>
                  <section>
                    <h3 className="label">Facts</h3>
                    <ul className="row-list">
                      {research.facts.map((f, k) => (
                        <li key={k} className={`row flex gap-3 ${f.confidence === 'medium' ? 'opacity-45' : ''}`}>
                          <span className="badge badge-quiet mt-0.5 shrink-0">{f.type}</span>
                          <span className="min-w-0 flex-1">
                            {f.text}{' '}
                            <a className="text-primary" href={f.sourceUrl} target="_blank" rel="noreferrer">
                              source
                            </a>
                            {f.confidence === 'medium' && <span className="text-muted"> · dropped before writing</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <h3 className="label">Misconceptions</h3>
                    <ul className="row-list">
                      {research.misconceptions.map((m, k) => (
                        <li key={k} className="row">
                          <p className="text-muted line-through">{m.belief}</p>
                          <p>
                            {m.reality}{' '}
                            <a className="text-primary" href={m.sourceUrl} target="_blank" rel="noreferrer">
                              source
                            </a>
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                  {research.codeExample && (
                    <section>
                      <h3 className="label">Code example · {research.codeExample.language}</h3>
                      <pre className="scroll-slim overflow-x-auto rounded-[12px] border border-hairline bg-surface-soft p-3 font-mono text-[13px]">
                        {research.codeExample.snippet}
                      </pre>
                      <p className="mt-2 text-body">{research.codeExample.explanation}</p>
                    </section>
                  )}
                  <section>
                    <h3 className="label">What changes in your code</h3>
                    <p>{research.devImplication}</p>
                  </section>
                </div>
              ) : (
                <p className="p-5 text-[14px] text-muted">No research stored for this draft.</p>
              ))}

            {pane === 'critique' && (
              <div className="space-y-4 p-5 text-[14px]">
                {draft.critique.issues.length > 0 && (
                  <section>
                    <h3 className="label">Issues</h3>
                    <ul className="row-list">
                      {draft.critique.issues.map((i, k) => (
                        <li key={k} className="row">
                          {i}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {draft.critique.strengths.length > 0 && (
                  <section>
                    <h3 className="label">Strengths</h3>
                    <ul className="row-list text-body">
                      {draft.critique.strengths.map((s, k) => (
                        <li key={k} className="row">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {draft.critique.issues.length === 0 && draft.critique.strengths.length === 0 && (
                  <p className="text-muted">The critic left no notes.</p>
                )}
                {previous && (
                  <details className="border-t border-hairline pt-3">
                    <summary className="cursor-pointer text-[13px] text-primary">
                      Show the failed v{previous.version}, scored {previous.critique.score}
                    </summary>
                    <div className="post-text mt-3 rounded-[12px] border border-hairline bg-surface-soft p-3 text-[14px]">
                      {previous.body}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>

          <Card title={`Hook · first ${LINKEDIN_FOLD} characters`}>
            <p className="post-text">
              {body.slice(0, LINKEDIN_FOLD)}
              {body.length > LINKEDIN_FOLD && <span className="text-muted">… see more</span>}
            </p>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Sources">
            {sources.length === 0 ? (
              <p className="text-[13px] text-muted">No sources recorded.</p>
            ) : (
              <ul className="row-list">
                {sources.map((s) => (
                  <li key={s.url} className="row min-w-0">
                    <a
                      className="t-body-sm line-clamp-2 font-medium break-words text-primary hover:underline"
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {s.title ?? s.url}
                    </a>
                    <div className="t-caption mt-0.5 flex flex-wrap items-center gap-x-2 text-muted">
                      <span className="truncate">{new URL(s.url).hostname}</span>
                      {s.resolved === false && <span className="text-down">fetch failed</span>}
                      {s.facts > 0 && (
                        <span>
                          <span className="t-number text-[12px]">{s.facts}</span> fact{s.facts === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {canDecide && (
            <Card title="Decision">
              <div className="space-y-3">
                <div>
                  <label className="label" htmlFor="when">
                    Schedule
                  </label>
                  <input
                    id="when"
                    type="datetime-local"
                    className="input w-full"
                    value={when}
                    min={toLocalInput(new Date())}
                    onChange={(e) => setWhen(e.target.value)}
                  />
                  <p className="t-caption mt-1.5 text-muted">Leave empty to publish immediately.</p>
                </div>

                {approveBlocker && <p className="t-caption text-muted">{approveBlocker}</p>}

                <ActionButton
                  className="btn btn-primary w-full"
                  disabled={Boolean(approveBlocker)}
                  pendingLabel="Publishing…"
                  onClick={() =>
                    run(async () => {
                      const scheduledFor = when ? new Date(when).toISOString() : undefined;
                      const r = await sendJson<{ outcome: { status: string; error?: string; postUrn?: string } }>(
                        `/api/drafts/${draft._id}/approve`,
                        'POST',
                        { scheduledFor },
                      );
                      if (r.outcome.status === 'published') return `Published to LinkedIn: ${r.outcome.postUrn}`;
                      if (r.outcome.status === 'failed') throw new Error(`Approved, but publishing failed: ${r.outcome.error}`);
                      return 'Approved and scheduled.';
                    })
                  }
                >
                  {when ? 'Approve & schedule' : 'Approve & publish now'}
                </ActionButton>

                <ActionButton
                  className="btn btn-danger w-full"
                  pendingLabel="Rejecting…"
                  onClick={() => {
                    const reason = window.prompt('Why reject? This becomes the concept note.');
                    if (reason === null) return;
                    return run(async () => {
                      await sendJson(`/api/drafts/${draft._id}`, 'PATCH', { status: 'rejected', reason });
                      return 'Rejected. The concept is back in the backlog.';
                    });
                  }}
                >
                  Reject
                </ActionButton>

                <div className="border-t border-hairline pt-3">
                  <label className="label" htmlFor="angle">
                    Rewrite with a different angle
                  </label>
                  <div className="flex gap-2">
                    <select id="angle" className="input w-full" value={angle} onChange={(e) => setAngle(e.target.value as (typeof ANGLES)[number])}>
                      {ANGLES.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                    <ActionButton
                      className="btn btn-quiet"
                      pendingLabel="Writing…"
                      onClick={() =>
                        run(async () => {
                          const r = await sendJson<{ result: { status: string; score: number } }>(
                            `/api/drafts/${draft._id}/regenerate`,
                            'POST',
                            { angle },
                          );
                          return r.result.status === 'pass'
                            ? `Rewritten, scored ${r.result.score}. It is at the top of the pending list.`
                            : `The rewrite scored ${r.result.score} and was killed. The concept went back to the backlog.`;
                        })
                      }
                    >
                      Rewrite
                    </ActionButton>
                  </div>
                  <p className="t-caption mt-1.5 text-muted">Reuses the existing research. Takes a minute or two.</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
