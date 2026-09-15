'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getJson, sendJson, fmtDate, trackClass, toLocalInput, LINKEDIN_FOLD } from '@/lib/ui';
import { checkHardConstraints, MIN_CHARS, MAX_CHARS } from '@/lib/pipeline/constraints';

type Status = 'pending' | 'approved' | 'rejected' | 'published';
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DraftDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    try {
      const { drafts } = await getJson<{ drafts: DraftRow[] }>(`/api/drafts?status=${tab}`);
      setRows(drafts);
      setSelectedId((cur) => (cur && drafts.some((d) => d._id === cur) ? cur : (drafts[0]?._id ?? null)));
    } catch (e) {
      setError((e as Error).message);
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
  }, [loadList]);
  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const run = async (label: string, fn: () => Promise<string | void>) => {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const msg = await fn();
      if (msg) setNotice(msg);
      await loadList();
      if (selectedId) await loadDetail(selectedId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {(['pending', 'approved', 'published', 'rejected'] as Status[]).map((s) => (
            <button
              key={s}
              className={`btn ${tab === s ? 'border-accent text-accent' : ''}`}
              onClick={() => setTab(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <ul className="space-y-2">
          {rows.length === 0 && <li className="text-sm text-muted">Nothing {tab}.</li>}
          {rows.map((d) => (
            <li key={d._id}>
              <button
                onClick={() => setSelectedId(d._id)}
                className={`panel w-full text-left hover:border-accent ${selectedId === d._id ? 'border-accent' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{d.concept?.title ?? '?'}</span>
                  <span className="text-xs text-muted">{d.critique.score}/10</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
                  <span className={`pill ${trackClass(d.concept?.track ?? '')}`}>{d.concept?.track}</span>
                  <span className="pill">{d.angle}</span>
                  <span>v{d.version}</span>
                  <span>{d.charCount} ch</span>
                  {d.editedByHuman && <span className="pill">edited</span>}
                </div>
                <div className="mt-1 text-xs text-muted">{fmtDate(d.createdAt)}</div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="min-w-0 space-y-3">
        {error && <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm">{error}</div>}
        {notice && <div className="rounded-md border border-ok/40 bg-ok/10 px-3 py-2 text-sm">{notice}</div>}
        {!detail ? (
          <div className="panel text-sm text-muted">
            Select a draft. No drafts yet? Run <code>npm run draft prompt-caching</code>, or generate from the Backlog screen.
          </div>
        ) : (
          <DraftPanel key={detail.draft._id} detail={detail} busy={busy} run={run} />
        )}
      </section>
    </div>
  );
}

function DraftPanel({
  detail,
  busy,
  run,
}: {
  detail: DraftDetail;
  busy: string | null;
  run: (label: string, fn: () => Promise<string | void>) => Promise<void>;
}) {
  const { draft, concept, research, previous, publication } = detail;
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(draft.body);
  const [readToEnd, setReadToEnd] = useState(false);
  const [when, setWhen] = useState('');
  const [angle, setAngle] = useState<(typeof ANGLES)[number]>('mechanism');
  const [showResearch, setShowResearch] = useState(false);
  const [showPrevious, setShowPrevious] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const violations = useMemo(() => checkHardConstraints(body), [body]);
  const dirty = body !== draft.body;
  const hookPreview = body.slice(0, LINKEDIN_FOLD);

  // Lazy-approve trap (spec §14.4): the approve button enables only after a scroll to the bottom.
  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight + 4 || el.scrollTop + el.clientHeight >= el.scrollHeight - 8) {
      setReadToEnd(true);
    }
  }, []);
  useEffect(() => {
    // Only auto-enable when the box is not scrollable at all.
    const el = scrollRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 4) setReadToEnd(true);
  }, [body, editing]);

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

  const canDecide = draft.status === 'pending' || draft.status === 'approved';
  const approveDisabled = !canDecide || !readToEnd || dirty || editing || busy !== null;

  return (
    <>
      <div className="panel">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold">{concept?.title ?? 'Unknown concept'}</h1>
            <p className="text-sm text-muted">{concept?.oneLiner}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className={`pill ${trackClass(concept?.track ?? '')}`}>{concept?.track}</span>
            <span className="pill">{draft.angle}</span>
            <span className="pill">v{draft.version}</span>
            <span className={`pill ${draft.critique.depthPassed ? 'text-ok' : 'text-warn'}`}>
              critic {draft.critique.score}/10
            </span>
            <span className="pill">{draft.status}</span>
          </div>
        </div>
        {publication && (
          <p className="mt-2 text-sm">
            Publication: <b>{publication.status}</b> · {fmtDate(publication.scheduledFor)}
            {publication.postUrn && <span className="text-muted"> · {publication.postUrn}</span>}
            {publication.error && <span className="text-danger"> · {publication.error}</span>}
          </p>
        )}
        {draft.rejectionReason && <p className="mt-2 text-sm text-danger">Rejected: {draft.rejectionReason}</p>}
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <div className="panel">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="label mb-0">Draft</span>
              <span className={`text-xs ${body.length < MIN_CHARS || body.length > MAX_CHARS ? 'text-danger' : 'text-muted'}`}>
                {body.length} / {MIN_CHARS}–{MAX_CHARS} chars
              </span>
            </div>
            {editing ? (
              <textarea
                className="input min-h-[420px] font-sans text-[15px] leading-relaxed"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            ) : (
              <div
                ref={scrollRef}
                onScroll={checkScroll}
                className="post-text max-h-[520px] overflow-y-auto rounded-md border border-border p-3 text-[15px]"
              >
                {body}
              </div>
            )}
            {violations.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-warn">
                {violations.map((v) => (
                  <li key={v}>⚠ {v}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {canDecide && !editing && (
                <button className="btn" onClick={() => setEditing(true)}>
                  Edit
                </button>
              )}
              {editing && (
                <>
                  <button
                    className="btn btn-primary"
                    disabled={!dirty || busy !== null}
                    onClick={() =>
                      run('save', async () => {
                        await sendJson(`/api/drafts/${draft._id}`, 'PATCH', { body });
                        setEditing(false);
                        setReadToEnd(false);
                        return 'Saved your edit.';
                      })
                    }
                  >
                    Save
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      setBody(draft.body);
                      setEditing(false);
                    }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="panel">
            <span className="label">Hook as LinkedIn shows it (first {LINKEDIN_FOLD} chars)</span>
            <p className="post-text text-sm">
              {hookPreview}
              {body.length > LINKEDIN_FOLD && <span className="text-accent"> …see more</span>}
            </p>
          </div>

          <div className="panel">
            <span className="label">Critique</span>
            {draft.critique.issues.length > 0 && (
              <ul className="mb-2 list-disc space-y-0.5 pl-5 text-sm">
                {draft.critique.issues.map((i, k) => (
                  <li key={k}>{i}</li>
                ))}
              </ul>
            )}
            {draft.critique.strengths.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted">
                {draft.critique.strengths.map((s, k) => (
                  <li key={k}>{s}</li>
                ))}
              </ul>
            )}
            {previous && (
              <div className="mt-2">
                <button className="text-xs text-accent" onClick={() => setShowPrevious((v) => !v)}>
                  {showPrevious ? 'Hide' : 'Show'} the failed v{previous.version} (score {previous.critique.score})
                </button>
                {showPrevious && <div className="post-text mt-2 rounded-md border border-border p-3 text-sm">{previous.body}</div>}
              </div>
            )}
          </div>

          {research && (
            <div className="panel">
              <button className="label text-left" onClick={() => setShowResearch((v) => !v)}>
                Research file {showResearch ? '▾' : '▸'}
              </button>
              {showResearch && (
                <div className="space-y-3 text-sm">
                  <div>
                    <b>Mechanism</b>
                    <p className="post-text mt-1">{research.mechanism}</p>
                  </div>
                  <div>
                    <b>Facts ({research.facts.length})</b>
                    <ul className="mt-1 space-y-1">
                      {research.facts.map((f, k) => (
                        <li key={k} className={f.confidence === 'medium' ? 'text-muted line-through' : ''}>
                          <span className="pill mr-1">{f.type}</span>
                          {f.text}{' '}
                          <a className="text-accent" href={f.sourceUrl} target="_blank" rel="noreferrer">
                            source
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <b>Misconceptions</b>
                    <ul className="mt-1 space-y-1">
                      {research.misconceptions.map((m, k) => (
                        <li key={k}>
                          <i>{m.belief}</i> → {m.reality}{' '}
                          <a className="text-accent" href={m.sourceUrl} target="_blank" rel="noreferrer">
                            source
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {research.codeExample && (
                    <div>
                      <b>Code example ({research.codeExample.language})</b>
                      <pre className="mt-1 overflow-x-auto rounded-md border border-border p-2 font-mono text-xs">
                        {research.codeExample.snippet}
                      </pre>
                      <p className="mt-1 text-muted">{research.codeExample.explanation}</p>
                    </div>
                  )}
                  <div>
                    <b>Dev implication</b>
                    <p className="mt-1">{research.devImplication}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="panel">
            <span className="label">Sources — verify before approving</span>
            <ul className="space-y-2 text-sm">
              {sources.map((s) => (
                <li key={s.url} className="break-words">
                  <a className="text-accent underline-offset-2 hover:underline" href={s.url} target="_blank" rel="noreferrer">
                    {s.title ?? s.url}
                  </a>
                  <div className="text-xs text-muted">
                    {s.url}
                    {s.resolved === false && <span className="text-danger"> · failed to fetch</span>}
                    {s.resolved && ' · fetched'}
                    {s.facts > 0 && ` · ${s.facts} fact${s.facts === 1 ? '' : 's'}`}
                  </div>
                </li>
              ))}
              {sources.length === 0 && <li className="text-muted">No sources recorded.</li>}
            </ul>
          </div>

          {canDecide && (
            <div className="panel space-y-3">
              <span className="label">Decision</span>
              {!readToEnd && <p className="text-xs text-warn">Scroll to the end of the draft to enable approve.</p>}
              {dirty && <p className="text-xs text-warn">Save or cancel your edit first.</p>}
              <div>
                <label className="label" htmlFor="when">
                  Schedule (empty = publish now)
                </label>
                <input
                  id="when"
                  type="datetime-local"
                  className="input"
                  value={when}
                  min={toLocalInput(new Date())}
                  onChange={(e) => setWhen(e.target.value)}
                />
              </div>
              <button
                className="btn btn-primary w-full justify-center"
                disabled={approveDisabled}
                onClick={() =>
                  run('approve', async () => {
                    const scheduledFor = when ? new Date(when).toISOString() : undefined;
                    const r = await sendJson<{ outcome: { status: string; error?: string; postUrn?: string } }>(
                      `/api/drafts/${draft._id}/approve`,
                      'POST',
                      { scheduledFor },
                    );
                    if (r.outcome.status === 'published') return `Published: ${r.outcome.postUrn}`;
                    if (r.outcome.status === 'failed') throw new Error(`Approved, but publishing failed: ${r.outcome.error}`);
                    return 'Approved and scheduled.';
                  })
                }
              >
                {busy === 'approve' ? 'Working…' : when ? 'Approve & schedule' : 'Approve & publish now'}
              </button>
              <button
                className="btn btn-danger w-full justify-center"
                disabled={busy !== null}
                onClick={() => {
                  const reason = window.prompt('Why reject? (goes into the concept note)') ?? '';
                  void run('reject', async () => {
                    await sendJson(`/api/drafts/${draft._id}`, 'PATCH', { status: 'rejected', reason });
                    return 'Rejected; concept returned to the backlog.';
                  });
                }}
              >
                Reject
              </button>
              <div className="flex gap-2">
                <select className="input" value={angle} onChange={(e) => setAngle(e.target.value as (typeof ANGLES)[number])}>
                  {ANGLES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <button
                  className="btn whitespace-nowrap"
                  disabled={busy !== null}
                  onClick={() =>
                    run('regenerate', async () => {
                      const r = await sendJson<{ result: { status: string; score: number } }>(
                        `/api/drafts/${draft._id}/regenerate`,
                        'POST',
                        { angle },
                      );
                      return r.result.status === 'pass'
                        ? `Regenerated (score ${r.result.score}). The new draft is in the pending list.`
                        : `Regenerated draft died (score ${r.result.score}); concept returned to backlog.`;
                    })
                  }
                >
                  {busy === 'regenerate' ? 'Writing…' : 'Regenerate'}
                </button>
              </div>
              <p className="text-xs text-muted">Regenerate reuses the research; it takes a minute or two.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
