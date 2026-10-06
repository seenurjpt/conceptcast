'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getJson, sendJson, fmtRelative, fmtDate, toLocalInput, LINKEDIN_FOLD } from '@/lib/ui';
import { checkHardConstraints, lengthLimits } from '@/lib/pipeline/constraints';
import { useSession } from '@/components/SessionProvider';
import { Modal, useDialog } from '@/components/Modal';
import { PublishSlider } from '@/components/PublishSlider';
import { customTitle } from '@/lib/customPost';
import {
  ActionButton,
  CharMeter,
  Card,
  EmptyState,
  Notice,
  PageHeader,
  ScoreBadge,
  Segmented,
  Switch,
  TrackBadge,
} from '@/components/ui';
import { APP_URL, WATERMARK_LINE, watermarkWouldOverflow } from '@/lib/watermark';

/** Per-browser memory of the last watermark choice. Off until the author turns it on. */
const WATERMARK_PREF_KEY = 'cc_watermark';
function readWatermarkPref(): boolean {
  try {
    return localStorage.getItem(WATERMARK_PREF_KEY) === '1';
  } catch {
    return false;
  }
}
function writeWatermarkPref(on: boolean): void {
  try {
    localStorage.setItem(WATERMARK_PREF_KEY, on ? '1' : '0');
  } catch {
    /* private mode: the choice just is not remembered */
  }
}

type Status = 'pending' | 'approved' | 'published' | 'rejected';
const isStatus = (s: string | null): s is Status =>
  s === 'pending' || s === 'approved' || s === 'published' || s === 'rejected';
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
  /** Older rows arrive without it; treated as 'post'. */
  kind?: 'post' | 'announcement' | 'custom';
  angle: string;
  hook: string;
  body: string;
  charCount: number;
  version: number;
  status: Status;
  editedByHuman: boolean;
  rejectionReason: string | null;
  createdAt: string;
  /** Null for announcements: they get the machine checks but no critic. */
  critique: { score: number; issues: string[]; strengths: string[]; depthPassed: boolean; revisionOf: string | null } | null;
  /** What the author typed for an announcement; reused by "Write it again". */
  announce?: { why: string | null; cadence: string | null } | null;
  concept: ConceptLite | null;
  topic?: { _id: string; title: string } | null;
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
  /** The main topic, sent for announcements (posts reach it through the concept). */
  topic?: { _id: string; title: string; description?: string } | null;
  constraintViolations: string[];
}

const isAnnouncement = (d: Pick<DraftRow, 'kind'>) => d.kind === 'announcement';
/** Written by the author in the composer. */
const isCustom = (d: Pick<DraftRow, 'kind'>) => d.kind === 'custom';
/** What to call a draft in the list and the panel header. */
function draftTitle(d: DraftRow, topicTitle?: string | null): string {
  if (isCustom(d)) return customTitle(d.hook);
  if (isAnnouncement(d)) return `Starting ${topicTitle ?? d.topic?.title ?? 'a new topic'}`;
  return d.concept?.title ?? 'Unknown';
}

export default function ReviewPage() {
  // ?status= picks the tab and ?draft= the draft (search links to any draft,
  // whatever its status). Followed on later changes too, so a search from
  // this page opens its result without a reload.
  const params = useSearchParams();
  const wantStatus = params.get('status');
  const wantDraft = params.get('draft');
  const [tab, setTab] = useState<Status>(() => (isStatus(wantStatus) ? wantStatus : 'pending'));
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
      // ?draft=<id> comes from the Topics screen, so a freshly written post
      // opens straight away instead of making you hunt for it.
      const requested = new URLSearchParams(window.location.search).get('draft');
      setSelectedId((cur) => {
        if (requested && drafts.some((d) => d._id === requested)) return requested;
        if (cur && drafts.some((d) => d._id === cur)) return cur;
        return drafts[0]?._id ?? null;
      });
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
    if (isStatus(wantStatus)) setTab(wantStatus);
    if (wantDraft) setSelectedId(wantDraft);
  }, [wantStatus, wantDraft]);

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
        title="Drafts"
        subtitle="Every claim carries a source. Open them before you approve. Your name goes on this."
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
          <EmptyState title={tab === 'pending' ? 'No drafts waiting' : `Nothing ${tab}`}>
            {tab === 'pending' ? (
              <>
                <span className="block">Pick a topic and write one. It takes about three minutes.</span>
                <Link href="/backlog" className="btn btn-primary btn-sm mt-4">
                  Browse topics
                </Link>
              </>
            ) : (
              <>Drafts you {tab === 'rejected' ? 'reject' : tab} will appear here.</>
            )}
          </EmptyState>
        </div>
      ) : (
        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[300px_1fr]">
          {/* A sideways strip on phones. Stacked vertically, every draft card
              sits above the one you selected, so you scroll past the whole
              queue to read it. */}
          <ul className="scroll-slim -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:block lg:space-y-2 lg:overflow-visible lg:px-0">
            {rows.map((d) => (
              <li key={d._id} className="w-[78%] shrink-0 snap-start sm:w-[48%] lg:w-auto">
                <button
                  onClick={() => setSelectedId(d._id)}
                  className={`card card-hover h-full w-full p-4 text-left ${selectedId === d._id ? 'card-selected' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="t-title-sm min-w-0 flex-1 truncate">{draftTitle(d)}</span>
                    {d.critique && <ScoreBadge score={d.critique.score} passed={d.critique.depthPassed} />}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {isCustom(d) ? (
                      <TrackBadge track="your-post" />
                    ) : isAnnouncement(d) ? (
                      <TrackBadge track="announcement" />
                    ) : (
                      <>
                        <TrackBadge track={d.concept?.track} />
                        <span className="badge badge-quiet">{d.angle}</span>
                      </>
                    )}
                    {d.editedByHuman && <span className="badge badge-quiet">edited</span>}
                  </div>
                  <div className="t-caption mt-2 truncate text-muted">
                    {d.topic?.title && <>{d.topic.title} · </>}
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
  const { draft, concept, research, previous, publication, topic } = detail;
  const announcement = isAnnouncement(draft);
  const custom = isCustom(draft);
  const kind = draft.kind ?? 'post';
  // Announcements and your own posts have no subtopic, research or critic.
  const simple = announcement || custom;
  const limits = lengthLimits(kind);
  const { session } = useSession();
  const dialog = useDialog();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(draft.body);
  const [when, setWhen] = useState('');
  const [angle, setAngle] = useState<(typeof ANGLES)[number]>('mechanism');
  const [pane, setPane] = useState<'draft' | 'research' | 'critique'>('draft');
  const [watermark, setWatermark] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  useEffect(() => setWatermark(readWatermarkPref()), []);
  const watermarkOverflow = watermark && watermarkWouldOverflow(body);

  const violations = useMemo(() => checkHardConstraints(body, { kind }), [body, kind]);
  const dirty = body !== draft.body;
  const canDecide = draft.status === 'pending' || draft.status === 'approved';
  const canPublish = session?.signedIn ?? false;

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
      : !canPublish && !when
          ? 'Sign in with LinkedIn to publish now, or pick a time to schedule it.'
          : watermarkOverflow
            ? 'With the watermark this post passes LinkedIn’s 3000 character limit. Shorten it or turn the watermark off.'
            : null;

  // The same problems in a few words: the slider's error label when one
  // stops a publish.
  const shortBlocker = !approveBlocker
    ? null
    : dirty
      ? 'Save your edit first'
      : !canPublish && !when
          ? 'Sign in or schedule'
          : 'Too long';

  const publishedMsg = useRef<string | null>(null);
  const confirmPublish = async () => {
    if (approveBlocker) throw new Error(approveBlocker);
    const scheduledFor = when ? new Date(when).toISOString() : undefined;
    const r = await sendJson<{ outcome: { status: string; error?: string; postUrn?: string } }>(
      `/api/drafts/${draft._id}/approve`,
      'POST',
      { scheduledFor, watermark },
    );
    if (r.outcome.status === 'failed') throw new Error(`Approved, but publishing failed: ${r.outcome.error}`);
    publishedMsg.current = r.outcome.status === 'published' ? `Published to LinkedIn: ${r.outcome.postUrn}` : 'Approved and scheduled.';
  };
  // Let the done pill show before the list refreshes and this draft moves on.
  const afterPublish = () => {
    window.setTimeout(() => void run(async () => publishedMsg.current ?? undefined), 1400);
  };
  const publishFailed = (reason: unknown) => {
    void run(async () => {
      throw reason instanceof Error ? reason : new Error(String(reason));
    });
  };
  const sliderLabel = when ? 'Slide to schedule' : 'Slide to publish';
  const sliderDone = when ? 'Scheduled' : 'Published';

  return (
    <div className={`min-w-0 space-y-4 ${canDecide ? 'pb-24 xl:pb-0' : ''}`}>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="t-title">{simple ? draftTitle(draft, topic?.title) : (concept?.title ?? 'Unknown concept')}</h2>
            <p className="t-body-sm mt-0.5 text-body">
              {custom
                ? 'A post you wrote. Only LinkedIn’s 3000 character limit applies.'
                : announcement ? 'Telling your network you are learning this in public. No research or critic score; the machine checks still run.' : concept?.oneLiner}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {custom ? (
              <TrackBadge track="your-post" />
            ) : announcement ? (
              <TrackBadge track="announcement" />
            ) : (
              <>
                <TrackBadge track={concept?.track} />
                <span className="badge badge-quiet">{draft.angle}</span>
              </>
            )}
            <span className="badge badge-quiet">v{draft.version}</span>
            {draft.critique && <ScoreBadge score={draft.critique.score} passed={draft.critique.depthPassed} />}
            {!simple && (
              <button type="button" className="btn btn-quiet btn-sm ml-1" onClick={() => setSourcesOpen(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
                  <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
                </svg>
                Sources
                <span className="rounded-full bg-[var(--surface-strong)] px-1.5 text-[11px] font-semibold leading-[18px]">{sources.length}</span>
              </button>
            )}
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
        <div className="min-w-0 xl:col-start-1 xl:row-start-1">
          <div className="card-flush">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-5 py-3">
              <Segmented
                value={pane}
                onChange={setPane}
                options={
                  simple
                    ? [{ value: 'draft', label: 'Draft' }]
                    : [
                        { value: 'draft', label: 'Draft' },
                        { value: 'research', label: 'Research', count: research?.facts.length },
                        { value: 'critique', label: 'Critique', count: draft.critique?.issues.length ?? 0 },
                      ]
                }
              />
              {pane === 'draft' && (
                <div className="flex items-center gap-3">
                  <CharMeter count={body.length} min={limits.min} max={limits.max} />
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
                    className="input w-full min-h-[300px] sm:min-h-[440px]"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    autoFocus
                  />
                ) : (
                  <div className="scroll-slim post-text max-h-[520px] overflow-y-auto pr-2">
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

            {pane === 'critique' && draft.critique && (
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
                      Show the failed v{previous.version}
                      {previous.critique ? `, scored ${previous.critique.score}` : ''}
                    </summary>
                    <div className="post-text mt-3 rounded-[12px] border border-hairline bg-surface-soft p-3 text-[14px]">
                      {previous.body}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 xl:col-start-1 xl:row-start-2">
          <Card title={`Hook · first ${LINKEDIN_FOLD} characters`}>
            <p className="post-text">
              {body.slice(0, LINKEDIN_FOLD)}
              {body.length > LINKEDIN_FOLD && <span className="text-muted">… see more</span>}
            </p>
          </Card>
        </div>

        <div className="min-w-0 space-y-4 xl:sticky xl:top-20 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          {canDecide && (
            <Card title="Publish">
              <div id="publish-card" className="scroll-mt-24 space-y-3">
                {approveBlocker && <p className="t-caption text-muted">{approveBlocker}</p>}

                <PublishSlider
                  label={sliderLabel}
                  doneLabel={sliderDone}
                  errorLabel={shortBlocker ?? 'Publishing failed'}
                  onConfirm={confirmPublish}
                  onDone={afterPublish}
                  onError={publishFailed}
                />

                <ActionButton
                  className="btn btn-danger w-full"
                  pendingLabel="Rejecting…"
                  onClick={async () => {
                    const reason = await dialog.prompt({
                      title: 'Reject this draft?',
                      body: 'The topic goes back to your list so you can try again. Your note is saved with it.',
                      label: 'Why are you rejecting it?',
                      placeholder: 'e.g. the mechanism is not explained deeply enough',
                      confirmLabel: 'Reject draft',
                      danger: true,
                      multiline: true,
                    });
                    if (reason === null) return;
                    return run(async () => {
                      await sendJson(`/api/drafts/${draft._id}`, 'PATCH', { status: 'rejected', reason });
                      return 'Rejected. The topic is back in your list.';
                    });
                  }}
                >
                  Reject
                </ActionButton>

                <div className="border-t border-hairline pt-3">
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
                </div>

                <div className="border-t border-hairline pt-3">
                  <Switch
                    id="watermark"
                    checked={watermark}
                    onChange={(on) => {
                      setWatermark(on);
                      writeWatermarkPref(on);
                    }}
                    label="Add “Posted from conceptcast”"
                    hint="A line under the post linking readers to the app."
                  />
                  {watermark && (
                    <p className="watermark-preview t-caption mt-2 text-body">
                      {WATERMARK_LINE.replace(APP_URL, '')}
                      <a className="text-primary hover:underline" href={APP_URL} target="_blank" rel="noreferrer">
                        {APP_URL}
                      </a>
                    </p>
                  )}
                </div>

                {custom ? null : announcement ? (
                  <div className="border-t border-hairline pt-3">
                    <ActionButton
                      className="btn btn-quiet w-full"
                      pendingLabel="Writing…"
                      disabled={!topic}
                      onClick={() =>
                        run(async () => {
                          await sendJson(`/api/topics/${topic?._id}/announce`, 'POST', {
                            why: draft.announce?.why ?? undefined,
                            cadence: draft.announce?.cadence ?? undefined,
                          });
                          return 'Rewritten. The new version is at the top of the pending list.';
                        })
                      }
                    >
                      Write it again
                    </ActionButton>
                    <p className="t-caption mt-1.5 text-muted">
                      A fresh take in a few seconds, keeping the reason and posting rhythm you gave. To change those, use
                      Announce on the topic page.
                    </p>
                  </div>
                ) : (
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
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Phones and tablets: the Publish card comes after the draft, so the
          primary action is pinned to the bottom of the screen as well. */}
      {canDecide && (
        <div className="review-actionbar xl:hidden">
          <div className="mx-auto flex max-w-[1200px] items-center gap-2 px-4 py-3 sm:px-5">
            <a href="#publish-card" className="btn btn-quiet btn-sm bar-options shrink-0">
              Options
            </a>
            <div className="min-w-0 flex-1">
              <PublishSlider
                height={44}
                label={sliderLabel}
                doneLabel={sliderDone}
                errorLabel={shortBlocker ?? 'Failed'}
                onConfirm={confirmPublish}
                onDone={afterPublish}
                onError={publishFailed}
              />
            </div>
          </div>
        </div>
      )}

      {sourcesOpen && (
        <Modal
          title="Sources"
          subtitle={
            sources.length
              ? `${sources.length} source${sources.length === 1 ? '' : 's'} · ${sources.reduce((n, x) => n + x.facts, 0)} facts cited. Open them before you approve.`
              : undefined
          }
          onClose={() => setSourcesOpen(false)}
          size="lg"
        >
          {sources.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted">No sources recorded for this draft.</p>
          ) : (
            <ul className="-my-1 divide-y divide-hairline">
              {sources.map((x) => {
                const host = new URL(x.url).hostname.replace(/^www\./, '');
                return (
                  <li key={x.url} className="flex min-w-0 items-start gap-3 py-3">
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-strong)] text-[12px] font-bold uppercase text-muted"
                    >
                      {host[0]}
                    </span>
                    <div className="min-w-0 flex-1">
                      {/* A source without a title falls back to its raw URL,
                          which has no spaces to break on: break-all, not
                          break-words, or it runs off the screen edge. */}
                      <p className={`t-body-sm line-clamp-2 font-semibold ${x.title ? 'break-words' : 'break-all'}`}>{x.title ?? x.url}</p>
                      <p className="t-caption mt-0.5 flex flex-wrap items-center gap-x-2 text-muted">
                        <span className="truncate">{host}</span>
                        {x.facts > 0 && (
                          <span className="rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-1.5 font-semibold text-primary">
                            {x.facts} fact{x.facts === 1 ? '' : 's'}
                          </span>
                        )}
                        {x.resolved === false && <span className="text-down">fetch failed</span>}
                      </p>
                    </div>
                    <a className="btn btn-quiet btn-sm shrink-0" href={x.url} target="_blank" rel="noreferrer">
                      Open<span className="sr-only"> {x.title ?? host} in a new tab</span>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                        <path d="M6 3h7v7M13 3 5 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}
