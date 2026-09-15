'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getJson, sendJson, trackClass } from '@/lib/ui';

const TRACKS = ['model-internals', 'retrieval', 'agents', 'production', 'evals', 'adaptation', 'security'] as const;
const STATUSES = ['backlog', 'selected', 'published', 'retired'] as const;

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
interface Proposal extends Omit<Concept, 'status' | 'timelinessBoost' | 'note'> {
  rationale: string;
  status: string;
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
  const [status, setStatus] = useState<string>('backlog');
  const [track, setTrack] = useState<string>('');
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [ranking, setRanking] = useState<Ranking[] | null>(null);

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
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const publishedSlugs = useMemo(() => new Set(concepts.filter((c) => c.status === 'published').map((c) => c.slug)), [concepts]);

  const visible = useMemo(
    () =>
      concepts.filter(
        (c) =>
          (!status || c.status === status) &&
          (!track || c.track === track) &&
          (!q || `${c.slug} ${c.title} ${c.oneLiner}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [concepts, status, track, q],
  );

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

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of concepts) m[c.status] = (m[c.status] ?? 0) + 1;
    return m;
  }, [concepts]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Backlog</h1>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn"
            disabled={busy !== null}
            onClick={() =>
              run('select', async () => {
                const r = await getJsonPost<{ ranked: Ranking[]; eligible: number; chosen: string | null }>('/api/pipeline/run', { dryRun: true });
                setRanking(r.ranked);
                return `${r.eligible} eligible; selector would pick ${r.chosen ?? 'nothing'}.`;
              })
            }
          >
            {busy === 'select' ? 'Ranking…' : 'Preview selector'}
          </button>
          <button
            className="btn btn-primary"
            disabled={busy !== null}
            onClick={() => {
              if (!window.confirm('Run the full pipeline now (select → research → write → critique)? Takes a few minutes.')) return;
              void run('pipeline', async () => {
                const r = await getJsonPost<{ chosen: string | null; generated: { status: string; score: number } | null; queued?: boolean }>(
                  '/api/pipeline/run',
                  {},
                );
                if (r.queued) return `Queued generation for ${r.chosen} via Inngest.`;
                if (!r.generated) return 'Nothing eligible to generate.';
                return `${r.chosen}: ${r.generated.status} (score ${r.generated.score}). See the review queue.`;
              });
            }}
          >
            {busy === 'pipeline' ? 'Running…' : 'Run pipeline now'}
          </button>
          <button className="btn" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? 'Close' : 'Add concept'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm">{error}</div>}
      {notice && <div className="rounded-md border border-ok/40 bg-ok/10 px-3 py-2 text-sm">{notice}</div>}

      {ranking && (
        <div className="panel">
          <div className="mb-2 flex items-center justify-between">
            <span className="label mb-0">Selector ranking (dry run)</span>
            <button className="text-xs text-accent" onClick={() => setRanking(null)}>
              close
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="py-1">concept</th>
                <th>teach</th>
                <th>surprise</th>
                <th>apply</th>
                <th>total</th>
                <th>reasoning</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r) => (
                <tr key={r.slug} className="border-t border-border align-top">
                  <td className="py-1 pr-2">
                    <div className="font-medium">{r.title}</div>
                    <span className={`pill ${trackClass(r.track)}`}>{r.track}</span>
                  </td>
                  <td>{r.teachability}</td>
                  <td>{r.surprise}</td>
                  <td>{r.applicability}</td>
                  <td className="font-semibold">{r.total}</td>
                  <td className="text-muted">{r.reasoning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddConceptForm existing={concepts.map((c) => c.slug)} onDone={() => run('add', async () => 'Concept added.')} />}

      {proposals.length > 0 && (
        <div className="panel">
          <span className="label">Proposed concepts awaiting your decision ({proposals.length})</span>
          <ul className="space-y-2">
            {proposals.map((p) => (
              <li key={p._id} className="flex flex-wrap items-start justify-between gap-2 border-t border-border pt-2 first:border-0 first:pt-0">
                <div className="min-w-0 text-sm">
                  <div className="font-medium">
                    {p.title} <span className="text-muted">({p.slug})</span> <span className={`pill ${trackClass(p.track)}`}>{p.track}</span>
                  </div>
                  <div className="text-muted">{p.oneLiner}</div>
                  <div className="text-xs text-muted">
                    {p.rationale} · prereqs: {p.prerequisites.join(', ') || 'none'} · sources:{' '}
                    {p.primarySources.map((s, i) => (
                      <a key={i} className="text-accent" href={s.url} target="_blank" rel="noreferrer">
                        {s.type}{' '}
                      </a>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className="btn" disabled={busy !== null} onClick={() => run('accept', async () => { await sendJson(`/api/proposals/${p._id}`, 'POST', { action: 'accept' }); return `Accepted ${p.slug}.`; })}>
                    Accept
                  </button>
                  <button className="btn btn-danger" disabled={busy !== null} onClick={() => run('reject', async () => { await sendJson(`/api/proposals/${p._id}`, 'POST', { action: 'reject' }); })}>
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="flex flex-wrap gap-1">
          <button className={`btn ${status === '' ? 'border-accent text-accent' : ''}`} onClick={() => setStatus('')}>
            all ({concepts.length})
          </button>
          {STATUSES.map((s) => (
            <button key={s} className={`btn ${status === s ? 'border-accent text-accent' : ''}`} onClick={() => setStatus(s)}>
              {s} ({counts[s] ?? 0})
            </button>
          ))}
        </div>
        <select className="input w-auto" value={track} onChange={(e) => setTrack(e.target.value)}>
          <option value="">all tracks</option>
          {TRACKS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input className="input w-56" placeholder="search" value={q} onChange={(e) => setQ(e.target.value)} />
        <button
          className="btn ml-auto"
          disabled={busy !== null}
          onClick={() => {
            if (!window.confirm('Ask the model to propose 10 new concepts now? (one Sonnet call)')) return;
            void run('propose', async () => {
              const r = await sendJson<{ proposals: Proposal[] }>('/api/proposals', 'POST');
              return `${r.proposals.length} proposals added above.`;
            });
          }}
        >
          {busy === 'propose' ? 'Proposing…' : 'Propose 10 concepts'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-1 pr-2">concept</th>
              <th className="pr-2">track</th>
              <th className="pr-2">diff</th>
              <th className="pr-2">prereqs</th>
              <th className="pr-2">relevance</th>
              <th className="pr-2">boost</th>
              <th className="pr-2">status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <ConceptRow key={c._id} c={c} publishedSlugs={publishedSlugs} busy={busy} run={run} />
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="py-4 text-muted">
                  Nothing matches. Seeded yet? Run <code>npm run seed</code>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function getJsonPost<T>(url: string, body: unknown): Promise<T> {
  return sendJson<T>(url, 'POST', body);
}

function ConceptRow({
  c,
  publishedSlugs,
  busy,
  run,
}: {
  c: Concept;
  publishedSlugs: Set<string>;
  busy: string | null;
  run: (label: string, fn: () => Promise<string | void>) => Promise<void>;
}) {
  const [rel, setRel] = useState(String(c.devRelevance));
  useEffect(() => setRel(String(c.devRelevance)), [c.devRelevance]);
  const eligible = c.status === 'backlog' && c.prerequisites.every((p) => publishedSlugs.has(p));

  return (
    <tr className="border-t border-border align-top">
      <td className="py-2 pr-2">
        <div className="font-medium">
          {c.title} <span className="font-normal text-muted">({c.slug})</span>
        </div>
        <div className="text-xs text-muted">{c.oneLiner}</div>
        {c.note && <div className="mt-0.5 text-xs text-warn">{c.note}</div>}
        <div className="mt-0.5 text-xs text-muted">
          {c.primarySources.map((s, i) => (
            <a key={i} className="mr-2 text-accent" href={s.url} target="_blank" rel="noreferrer">
              {s.type}
            </a>
          ))}
        </div>
      </td>
      <td className="pr-2">
        <span className={`pill ${trackClass(c.track)}`}>{c.track}</span>
      </td>
      <td className="pr-2">{c.difficulty}</td>
      <td className="pr-2 text-xs">
        {c.prerequisites.length === 0 && <span className="text-muted">—</span>}
        {c.prerequisites.map((p) => (
          <span key={p} className={`pill mr-1 ${publishedSlugs.has(p) ? 'text-ok' : 'text-muted'}`}>
            {p}
          </span>
        ))}
      </td>
      <td className="pr-2">
        <input
          className="input w-16"
          type="number"
          min={0}
          max={10}
          step={0.5}
          value={rel}
          onChange={(e) => setRel(e.target.value)}
          onBlur={() => {
            const n = Number(rel);
            if (!Number.isFinite(n) || n === c.devRelevance) return;
            void run('rel', async () => {
              await sendJson(`/api/concepts/${c.slug}`, 'PATCH', { devRelevance: Math.max(0, Math.min(10, n)) });
            });
          }}
        />
      </td>
      <td className="pr-2">{c.timelinessBoost > 0 ? <span className="pill text-warn">+{c.timelinessBoost}</span> : <span className="text-muted">0</span>}</td>
      <td className="pr-2">
        <span className={`pill ${c.status === 'published' ? 'text-ok' : c.status === 'selected' ? 'text-accent' : ''}`}>{c.status}</span>
        {c.status === 'backlog' && !eligible && <div className="text-xs text-muted">prereqs unmet</div>}
      </td>
      <td className="whitespace-nowrap">
        {c.status !== 'retired' && c.status !== 'published' && (
          <button
            className="btn mr-1"
            disabled={busy !== null}
            title={eligible ? 'Run the pipeline for this concept now' : 'Prerequisites not published yet — runs anyway'}
            onClick={() => {
              if (!window.confirm(`Generate a draft for "${c.title}" now? Takes a few minutes.`)) return;
              void run(`gen-${c.slug}`, async () => {
                const r = await sendJson<{ queued: boolean; result?: { status: string; score: number } }>(
                  `/api/concepts/${c.slug}/generate`,
                  'POST',
                  { force: c.status !== 'backlog' },
                );
                if (r.queued) return `Queued ${c.slug} via Inngest.`;
                return `${c.slug}: ${r.result?.status} (score ${r.result?.score}). See the review queue.`;
              });
            }}
          >
            {busy === `gen-${c.slug}` ? 'Generating…' : 'Generate'}
          </button>
        )}
        {c.status === 'backlog' && (
          <button className="btn" disabled={busy !== null} onClick={() => run('retire', async () => { await sendJson(`/api/concepts/${c.slug}`, 'DELETE'); })}>
            Retire
          </button>
        )}
        {c.status === 'retired' && (
          <button className="btn" disabled={busy !== null} onClick={() => run('unretire', async () => { await sendJson(`/api/concepts/${c.slug}`, 'PATCH', { status: 'backlog' }); })}>
            Restore
          </button>
        )}
      </td>
    </tr>
  );
}

function AddConceptForm({ existing, onDone }: { existing: string[]; onDone: () => void }) {
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
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form
      className="panel grid gap-2 md:grid-cols-2"
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
          setForm((f) => ({ ...f, slug: '', title: '', oneLiner: '', focus: '', prerequisites: '', sources: '' }));
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <div>
        <label className="label">slug</label>
        <input className="input" value={form.slug} onChange={set('slug')} placeholder="kv-cache" required />
        {existing.includes(form.slug) && <span className="text-xs text-danger">already exists</span>}
      </div>
      <div>
        <label className="label">title</label>
        <input className="input" value={form.title} onChange={set('title')} required />
      </div>
      <div>
        <label className="label">track</label>
        <select className="input" value={form.track} onChange={set('track')}>
          {TRACKS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">difficulty</label>
          <select className="input" value={form.difficulty} onChange={set('difficulty')}>
            <option>1</option>
            <option>2</option>
            <option>3</option>
          </select>
        </div>
        <div>
          <label className="label">relevance 0–10</label>
          <input className="input" type="number" min={0} max={10} step={0.5} value={form.devRelevance} onChange={set('devRelevance')} />
        </div>
      </div>
      <div className="md:col-span-2">
        <label className="label">one-liner (the hook-shaped angle)</label>
        <input className="input" value={form.oneLiner} onChange={set('oneLiner')} required />
      </div>
      <div className="md:col-span-2">
        <label className="label">focus (steer for the researcher)</label>
        <input className="input" value={form.focus} onChange={set('focus')} required />
      </div>
      <div>
        <label className="label">prerequisites (comma-separated slugs)</label>
        <input className="input" value={form.prerequisites} onChange={set('prerequisites')} />
      </div>
      <div>
        <label className="label">primary sources — one per line: type | url | title</label>
        <textarea className="input min-h-[60px]" value={form.sources} onChange={set('sources')} placeholder="docs | https://… | Title" />
      </div>
      {error && <div className="text-sm text-danger md:col-span-2">{error}</div>}
      <div className="md:col-span-2">
        <button className="btn btn-primary" type="submit">
          Add to backlog
        </button>
      </div>
    </form>
  );
}
