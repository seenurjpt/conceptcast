'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getJson, sendJson } from '@/lib/ui';
import {
  ActionButton,
  Card,
  EmptyState,
  Notice,
  PageHeader,
  Segmented,
  Stat,
  TrackBadge,
} from '@/components/ui';

const TRACKS = ['model-internals', 'retrieval', 'agents', 'production', 'evals', 'adaptation', 'security'] as const;
type StatusFilter = 'backlog' | 'selected' | 'published' | 'retired' | 'all';

interface Concept {
  _id: string;
  slug: string;
  title: string;
  track: string;
  oneLiner: string;
  focus: string;
  prerequisites: string[];
  difficulty: number;
  devRelevance: number;
  timelinessBoost: number;
  status: string;
  note: string | null;
  primarySources: { type: string; url: string; title: string }[];
}
interface Proposal {
  _id: string;
  slug: string;
  title: string;
  track: string;
  oneLiner: string;
  prerequisites: string[];
  rationale: string;
  primarySources: { type: string; url: string; title: string }[];
}
interface Ranking {
  slug: string;
  title: string;
  track: string;
  total: number;
  teachability: number;
  surprise: number;
  applicability: number;
  reasoning: string;
}

export default function BacklogPage() {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [status, setStatus] = useState<StatusFilter>('backlog');
  const [track, setTrack] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [ranking, setRanking] = useState<Ranking[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([
        getJson<{ concepts: Concept[] }>('/api/concepts'),
        getJson<{ proposals: Proposal[] }>('/api/proposals?status=pending'),
      ]);
      setConcepts(c.concepts);
      setProposals(p.proposals);
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

  const publishedSlugs = useMemo(
    () => new Set(concepts.filter((c) => c.status === 'published').map((c) => c.slug)),
    [concepts],
  );
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of concepts) m[c.status] = (m[c.status] ?? 0) + 1;
    return m;
  }, [concepts]);

  const visible = useMemo(
    () =>
      concepts.filter(
        (c) =>
          (status === 'all' || c.status === status) &&
          (!track || c.track === track) &&
          (!q || `${c.slug} ${c.title} ${c.oneLiner}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [concepts, status, track, q],
  );

  const ready = useMemo(
    () => concepts.filter((c) => c.status === 'backlog' && c.prerequisites.every((p) => publishedSlugs.has(p))).length,
    [concepts, publishedSlugs],
  );
  // At the spec's two posts a week. Counts the whole backlog: prerequisites
  // unlock as you publish, so a blocked concept is delayed, not lost.
  const weeksLeft = Math.floor((counts.backlog ?? 0) / 2);

  return (
    <>
      <PageHeader
        title="Backlog"
        subtitle="Prerequisites turn a list of posts into a curriculum. A concept becomes eligible once everything it builds on is published."
        actions={
          <>
            <ActionButton
              className="btn"
              pendingLabel="Ranking…"
              onClick={() =>
                run(async () => {
                  const r = await sendJson<{ ranked: Ranking[]; eligible: number; chosen: string | null }>(
                    '/api/pipeline/run',
                    'POST',
                    { dryRun: true },
                  );
                  setRanking(r.ranked);
                  return `${r.eligible} eligible. The selector would pick ${r.chosen ?? 'nothing'}.`;
                })
              }
            >
              Preview selector
            </ActionButton>
            <ActionButton
              className="btn btn-primary"
              pendingLabel="Running…"
              confirm="Run the full pipeline now? Research, writing and critique take a few minutes and spend tokens."
              onClick={() =>
                run(async () => {
                  const r = await sendJson<{ chosen: string | null; generated: { status: string; score: number } | null; queued?: boolean }>(
                    '/api/pipeline/run',
                    'POST',
                    {},
                  );
                  if (r.queued) return `Queued ${r.chosen} for generation.`;
                  if (!r.generated) return 'Nothing is eligible right now.';
                  return `${r.chosen}: ${r.generated.status}, scored ${r.generated.score}. See the review queue.`;
                })
              }
            >
              Run pipeline
            </ActionButton>
          </>
        }
      />

      <div className="space-y-3">
        {error && <Notice kind="error" onDismiss={() => setError(null)}>{error}</Notice>}
        {notice && <Notice kind="ok" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <Stat label="In backlog" value={counts.backlog ?? 0} />
        </Card>
        <Card>
          <Stat label="Ready now" value={ready} />
        </Card>
        <Card>
          <Stat label="Published" value={counts.published ?? 0} tone={counts.published ? 'up' : undefined} />
        </Card>
        <Card>
          <Stat label="Weeks at 2 a week" value={weeksLeft} />
        </Card>
      </div>

      {ranking && (
        <Card
          className="mt-4"
          title="Selector ranking"
          action={
            <button className="btn-text text-[13px]" onClick={() => setRanking(null)}>
              Close
            </button>
          }
        >
          <div className="scroll-slim -mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[640px] text-[14px]">
              <thead>
                <tr className="border-b border-hairline text-left">
                  <th className="label pb-2">Concept</th>
                  <th className="label pb-2">Teach</th>
                  <th className="label pb-2">Surprise</th>
                  <th className="label pb-2">Apply</th>
                  <th className="label pb-2">Total</th>
                  <th className="label pb-2">Why</th>
                </tr>
              </thead>
              <tbody className="row-list">
                {ranking.map((r) => (
                  <tr key={r.slug} className="align-top">
                    <td className="py-3 pr-3">
                      <div className="font-medium">{r.title}</div>
                      <TrackBadge track={r.track} />
                    </td>
                    <td className="t-number py-3">{r.teachability}</td>
                    <td className="t-number py-3">{r.surprise}</td>
                    <td className="t-number py-3">{r.applicability}</td>
                    <td className="t-number py-3 font-semibold">{r.total}</td>
                    <td className="py-3 pl-3 text-[13px] text-body">{r.reasoning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {proposals.length > 0 && (
        <Card className="mt-4" title={`Proposed concepts · ${proposals.length} awaiting you`}>
          <ul className="row-list">
            {proposals.map((p) => (
              <li key={p._id} className="row flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="t-title-sm">{p.title}</span>
                    <TrackBadge track={p.track} />
                    <span className="t-caption text-muted">{p.slug}</span>
                  </div>
                  <p className="t-body-sm mt-0.5 text-body">{p.oneLiner}</p>
                  <p className="t-caption mt-1 text-muted">{p.rationale}</p>
                  <div className="t-caption mt-1 flex flex-wrap gap-x-3 text-muted">
                    <span>Prerequisites: {p.prerequisites.join(', ') || 'none'}</span>
                    {p.primarySources.map((s, i) => (
                      <a key={i} className="text-primary" href={s.url} target="_blank" rel="noreferrer">
                        {s.type}
                      </a>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <ActionButton
                    className="btn btn-sm"
                    onClick={() => run(async () => {
                      await sendJson(`/api/proposals/${p._id}`, 'POST', { action: 'accept' });
                      return `Added ${p.slug} to the backlog.`;
                    })}
                  >
                    Accept
                  </ActionButton>
                  <ActionButton
                    className="btn btn-danger btn-sm"
                    onClick={() => run(async () => {
                      await sendJson(`/api/proposals/${p._id}`, 'POST', { action: 'reject' });
                    })}
                  >
                    Reject
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {showAdd && (
        <div className="mt-4">
          <AddConceptForm
            existing={concepts.map((c) => c.slug)}
            onDone={() => {
              setShowAdd(false);
              void run(async () => 'Concept added to the backlog.');
            }}
            onCancel={() => setShowAdd(false)}
          />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-3">
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: 'backlog', label: 'Backlog', count: counts.backlog ?? 0 },
            { value: 'selected', label: 'In flight', count: counts.selected ?? 0 },
            { value: 'published', label: 'Published', count: counts.published ?? 0 },
            { value: 'retired', label: 'Retired', count: counts.retired ?? 0 },
            { value: 'all', label: 'All', count: concepts.length },
          ]}
        />
        <select
          className="input h-9 w-auto min-w-[9rem] text-[13px]"
          value={track}
          onChange={(e) => setTrack(e.target.value)}
          aria-label="Filter by track"
        >
          <option value="">All tracks</option>
          {TRACKS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          className="input h-9 w-44 text-[13px]"
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search concepts"
        />
        <div className="ml-auto flex gap-2">
          <button className="btn btn-quiet btn-sm" onClick={() => setShowAdd((v) => !v)}>
            Add concept
          </button>
          <ActionButton
            className="btn btn-quiet btn-sm"
            pendingLabel="Proposing…"
            confirm="Ask the model to propose 10 new concepts? One Sonnet call with web search."
            onClick={() =>
              run(async () => {
                const r = await sendJson<{ proposals: Proposal[] }>('/api/proposals', 'POST');
                return `${r.proposals.length} proposals added above.`;
              })
            }
          >
            Propose 10
          </ActionButton>
        </div>
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="card h-64 animate-pulse" />
        ) : visible.length === 0 ? (
          <EmptyState title="Nothing matches">
            {concepts.length === 0 ? (
              <>
                The backlog is empty. Run <code className="t-number text-[13px]">npm run seed</code> to load the 63 seeded concepts.
              </>
            ) : (
              'Try a different filter.'
            )}
          </EmptyState>
        ) : (
          <ul className="card-flush row-list px-5">
            {visible.map((c) => (
              <ConceptRow key={c._id} c={c} publishedSlugs={publishedSlugs} run={run} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function ConceptRow({
  c,
  publishedSlugs,
  run,
}: {
  c: Concept;
  publishedSlugs: Set<string>;
  run: (fn: () => Promise<string | void>) => Promise<void>;
}) {
  const [rel, setRel] = useState(String(c.devRelevance));
  useEffect(() => setRel(String(c.devRelevance)), [c.devRelevance]);
  const unmet = c.prerequisites.filter((p) => !publishedSlugs.has(p));
  const eligible = c.status === 'backlog' && unmet.length === 0;

  return (
    <li className="row flex flex-wrap items-start gap-4">
      <div className="min-w-[240px] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="t-title-sm">{c.title}</span>
          <TrackBadge track={c.track} />
          {c.status !== 'backlog' && (
            <span className={`badge ${c.status === 'published' ? 'badge-up' : c.status === 'selected' ? 'badge-primary' : 'badge-quiet'}`}>
              {c.status}
            </span>
          )}
          {c.timelinessBoost > 0 && <span className="badge badge-attention">in the news +{c.timelinessBoost}</span>}
          {eligible && <span className="badge badge-quiet">ready</span>}
        </div>
        <p className="t-body-sm mt-0.5 text-body">{c.oneLiner}</p>
        {unmet.length > 0 && (
          <p className="t-caption mt-1 text-muted">Waiting on {unmet.join(', ')}</p>
        )}
        {c.note && <p className="t-caption mt-1 text-attention">{c.note}</p>}
        <div className="t-caption mt-1 flex flex-wrap gap-x-3 text-muted">
          <span>Difficulty {c.difficulty}</span>
          {c.primarySources.map((s, i) => (
            <a key={i} className="text-primary hover:underline" href={s.url} target="_blank" rel="noreferrer">
              {s.type}
            </a>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <input
          id={`rel-${c.slug}`}
          className="input t-number h-8 w-14 px-2 text-center text-[13px]"
          type="number"
          min={0}
          max={10}
          step={0.5}
          value={rel}
          title="Developer relevance, 0 to 10 — weights the selector"
          aria-label={`Relevance for ${c.title}`}
          onChange={(e) => setRel(e.target.value)}
          onBlur={() => {
            const n = Number(rel);
            if (!Number.isFinite(n) || n === c.devRelevance) return;
            void run(async () => {
              await sendJson(`/api/concepts/${c.slug}`, 'PATCH', { devRelevance: Math.max(0, Math.min(10, n)) });
            });
          }}
        />
        {c.status !== 'retired' && c.status !== 'published' && (
          <ActionButton
            className="btn btn-sm"
            pendingLabel="Generating…"
            title={eligible ? 'Run the pipeline for this concept' : 'Prerequisites are unmet, but it will run anyway'}
            confirm={`Generate a draft for "${c.title}"? Takes a few minutes and spends tokens.`}
            onClick={() =>
              run(async () => {
                const r = await sendJson<{ queued: boolean; result?: { status: string; score: number } }>(
                  `/api/concepts/${c.slug}/generate`,
                  'POST',
                  { force: c.status !== 'backlog' },
                );
                if (r.queued) return `Queued ${c.slug}.`;
                return r.result?.status === 'pass'
                  ? `${c.slug} scored ${r.result.score}. It is in the review queue.`
                  : `${c.slug} scored ${r.result?.score} and was killed. It is back in the backlog.`;
              })
            }
          >
            Generate
          </ActionButton>
        )}
        {c.status === 'backlog' && (
          <ActionButton
            className="btn btn-quiet btn-sm"
            onClick={() => run(async () => {
              await sendJson(`/api/concepts/${c.slug}`, 'DELETE');
              return `Retired ${c.slug}.`;
            })}
          >
            Retire
          </ActionButton>
        )}
        {c.status === 'retired' && (
          <ActionButton
            className="btn btn-quiet btn-sm"
            onClick={() => run(async () => {
              await sendJson(`/api/concepts/${c.slug}`, 'PATCH', { status: 'backlog' });
              return `Restored ${c.slug}.`;
            })}
          >
            Restore
          </ActionButton>
        )}
      </div>
    </li>
  );
}

function AddConceptForm({
  existing,
  onDone,
  onCancel,
}: {
  existing: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    slug: '',
    title: '',
    track: 'production',
    oneLiner: '',
    focus: '',
    prerequisites: '',
    difficulty: '1',
    devRelevance: '6',
    sources: '',
  });
  const [error, setError] = useState<string | null>(null);
  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  const duplicate = existing.includes(form.slug);

  return (
    <Card title="New concept">
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const primarySources = form.sources
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .map((l) => {
              const [type, url, ...title] = l.split('|').map((s) => s.trim());
              return { type, url, title: title.join('|') || url };
            });
          try {
            await sendJson('/api/concepts', 'POST', {
              slug: form.slug,
              title: form.title,
              track: form.track,
              oneLiner: form.oneLiner,
              focus: form.focus,
              prerequisites: form.prerequisites.split(',').map((s) => s.trim()).filter(Boolean),
              difficulty: Number(form.difficulty),
              devRelevance: Number(form.devRelevance),
              primarySources,
            });
            onDone();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <div>
          <label className="label" htmlFor="slug">
            Slug
          </label>
          <input id="slug" className="input w-full" value={form.slug} onChange={set('slug')} placeholder="kv-cache" required />
          {duplicate && <p className="t-caption mt-1 text-down">That slug already exists.</p>}
        </div>
        <div>
          <label className="label" htmlFor="title">
            Title
          </label>
          <input id="title" className="input w-full" value={form.title} onChange={set('title')} required />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="oneLiner">
            One-liner
          </label>
          <input
            id="oneLiner"
            className="input w-full"
            value={form.oneLiner}
            onChange={set('oneLiner')}
            placeholder="Why the second token is 100x cheaper than the first"
            required
          />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="focus">
            Focus for the researcher
          </label>
          <input id="focus" className="input w-full" value={form.focus} onChange={set('focus')} required />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label" htmlFor="track">
              Track
            </label>
            <select id="track" className="input w-full" value={form.track} onChange={set('track')}>
              {TRACKS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="difficulty">
              Difficulty
            </label>
            <select id="difficulty" className="input w-full" value={form.difficulty} onChange={set('difficulty')}>
              <option>1</option>
              <option>2</option>
              <option>3</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="devRelevance">
              Relevance
            </label>
            <input
              id="devRelevance"
              className="input w-full t-number"
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={form.devRelevance}
              onChange={set('devRelevance')}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="prereq">
            Prerequisites
          </label>
          <input id="prereq" className="input w-full" value={form.prerequisites} onChange={set('prerequisites')} placeholder="attention-mechanism, tokenization" />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="sources">
            Primary sources — one per line as type | url | title
          </label>
          <textarea
            id="sources"
            className="input w-full min-h-[72px] font-mono text-[13px]"
            value={form.sources}
            onChange={set('sources')}
            placeholder="docs | https://example.com/page | Page title"
          />
        </div>
        {error && (
          <div className="md:col-span-2">
            <Notice kind="error">{error}</Notice>
          </div>
        )}
        <div className="flex gap-2 md:col-span-2">
          <button className="btn btn-primary" type="submit" disabled={duplicate}>
            Add to backlog
          </button>
          <button className="btn btn-quiet" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
