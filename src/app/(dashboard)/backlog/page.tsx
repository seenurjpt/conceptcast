'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getJson, sendJson } from '@/lib/ui';
import { ActionButton, Card, EmptyState, Notice, PageHeader, TrackBadge } from '@/components/ui';

interface TopicSummary {
  _id: string;
  slug: string;
  title: string;
  description: string;
  origin: 'migrated' | 'user';
  counts: { backlog: number; selected: number; published: number; retired: number; total: number };
  /** Created by you, or a shared topic you started. */
  mine: boolean;
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
  source?: 'model' | 'news';
  story?: {
    headline: string;
    links: { url: string; title: string; feed: string; publishedAt: string | null }[];
    newestAt: string | null;
    clusterSize: number;
    score: number;
  } | null;
  expiresAt?: string | null;
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

function storyAge(d: string | null | undefined): string | null {
  if (!d) return null;
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  return days <= 0 ? 'today' : `${days}d old`;
}
function expiresIn(d: string | null | undefined): string | null {
  if (!d) return null;
  const hours = Math.round((new Date(d).getTime() - Date.now()) / 3_600_000);
  if (hours <= 0) return 'expiring';
  return hours < 48 ? `expires in ${hours}h` : `expires in ${Math.round(hours / 24)}d`;
}

export default function TopicsPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [ranking, setRanking] = useState<Ranking[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([
        getJson<{ topics: TopicSummary[] }>('/api/topics'),
        getJson<{ proposals: Proposal[] }>('/api/proposals?status=pending'),
      ]);
      setTopics(t.topics);
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

  const mine = topics.filter((t) => t.mine);
  const shared = topics.filter((t) => !t.mine);

  return (
    <>
      <PageHeader
        title="Topics"
        subtitle="Name something you are learning. Each topic gets a list of subtopics, and each subtopic becomes one researched post."
        actions={
          <>
            <ActionButton
              className="btn"
              pendingLabel="Thinking…"
              title="Score every waiting subtopic on teachability, surprise and applicability"
              onClick={() =>
                run(async () => {
                  const r = await sendJson<{ ranked: Ranking[]; eligible: number; chosen: string | null }>(
                    '/api/pipeline/run',
                    'POST',
                    { dryRun: true },
                  );
                  setRanking(r.ranked);
                  return r.chosen ? `Ranked ${r.eligible} subtopics. Best pick right now: ${r.chosen}.` : 'Nothing is waiting to be written.';
                })
              }
            >
              Suggest what to write next
            </ActionButton>
            <button className="btn btn-primary" onClick={() => setShowAdd((v) => !v)}>
              {showAdd ? 'Close' : 'Add topic'}
            </button>
          </>
        }
      />

      <div className="space-y-3">
        {error && <Notice kind="error" onDismiss={() => setError(null)}>{error}</Notice>}
        {notice && <Notice kind="ok" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      </div>

      {showAdd && (
        <div className="mt-4">
          <AddTopicForm
            onCreated={(id, msg) => {
              setShowAdd(false);
              setNotice(msg);
              router.push(`/backlog/${id}`);
            }}
            onCancel={() => setShowAdd(false)}
          />
        </div>
      )}

      {ranking && (
        <Card
          className="mt-4"
          title="What to write next"
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
                  <th className="label pb-2">Subtopic</th>
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
                      {r.track !== 'custom' && <TrackBadge track={r.track} />}
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

      <div className="mt-4">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card h-32 animate-pulse" />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <EmptyState title="No topics yet">
            <span className="block">Add the first thing you are learning. The model suggests about ten subtopics to start from.</span>
            <button className="btn btn-primary btn-sm mt-4" onClick={() => setShowAdd(true)}>
              Add a topic
            </button>
          </EmptyState>
        ) : (
          <>
            {mine.length > 0 && <TopicGrid heading="Your topics" topics={mine} />}
            {shared.length > 0 && (
              <TopicGrid heading={mine.length ? 'Also available' : 'Topics'} topics={shared} className={mine.length ? 'mt-6' : ''} />
            )}
          </>
        )}
      </div>

      {proposals.length > 0 && (
        <Card
          className="mt-6"
          title={
            proposals.some((p) => p.source === 'news')
              ? `From the news · ${proposals.filter((p) => p.source === 'news').length} awaiting you`
              : `Proposed subtopics · ${proposals.length} awaiting you`
          }
          action={
            proposals.some((p) => p.source === 'news') && (
              <span className="t-caption text-muted">Scanned daily. Unaccepted stories expire in a few days.</span>
            )
          }
        >
          <ul className="row-list">
            {[...proposals]
              .sort((a, b) => (a.source === 'news' ? 0 : 1) - (b.source === 'news' ? 0 : 1))
              .map((p) => (
                <li key={p._id} className="row flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="t-title-sm">{p.title}</span>
                      <TrackBadge track={p.track} />
                      {p.source === 'news' && <span className="badge badge-attention">news</span>}
                      {p.source === 'news' && storyAge(p.story?.newestAt) && (
                        <span className="t-caption text-muted">{storyAge(p.story?.newestAt)}</span>
                      )}
                      {p.source === 'news' && expiresIn(p.expiresAt) && (
                        <span className="t-caption text-muted">· {expiresIn(p.expiresAt)}</span>
                      )}
                    </div>
                    <p className="t-body-sm mt-0.5 text-body">{p.oneLiner}</p>
                    <p className="t-caption mt-1 text-muted">{p.rationale}</p>
                    {p.source === 'news' && p.story && (
                      <ul className="t-caption mt-1 space-y-0.5 text-muted">
                        {p.story.links.slice(0, 4).map((l, i) => (
                          <li key={i} className="truncate">
                            <a className="text-primary hover:underline" href={l.url} target="_blank" rel="noreferrer" title={l.url}>
                              {l.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <ActionButton
                      className="btn btn-sm"
                      onClick={() =>
                        run(async () => {
                          await sendJson(`/api/proposals/${p._id}`, 'POST', { action: 'accept' });
                          return `Added "${p.title}" under ${p.track}.`;
                        })
                      }
                    >
                      Accept
                    </ActionButton>
                    <ActionButton
                      className="btn btn-danger btn-sm"
                      onClick={() =>
                        run(async () => {
                          await sendJson(`/api/proposals/${p._id}`, 'POST', { action: 'reject' });
                        })
                      }
                    >
                      Reject
                    </ActionButton>
                  </div>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function TopicGrid({ heading, topics, className = '' }: { heading: string; topics: TopicSummary[]; className?: string }) {
  return (
    <section className={className}>
      <h2 className="label">{heading}</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((t) => {
          const { counts } = t;
          const drafted = counts.selected + counts.published;
          return (
            <li key={t._id}>
              <Link href={`/backlog/${t._id}`} className="card card-hover flex h-full flex-col gap-2 no-underline">
                <div className="flex items-start justify-between gap-2">
                  <span className="t-title-sm min-w-0">{t.title}</span>
                  {t.origin === 'migrated' && !t.mine && <span className="badge badge-quiet shrink-0">shared</span>}
                </div>
                {t.description && <p className="t-body-sm line-clamp-2 text-body">{t.description}</p>}
                <p className="t-caption mt-auto pt-1 text-muted">
                  {counts.total === 0 ? (
                    'No subtopics yet'
                  ) : (
                    <>
                      <span className="t-number text-[12px]">{counts.backlog}</span> to write
                      {drafted > 0 && (
                        <>
                          {' · '}
                          <span className="t-number text-[12px]">{drafted}</span> drafted
                        </>
                      )}
                      {counts.published > 0 && (
                        <>
                          {' · '}
                          <span className="t-number text-[12px] text-up">{counts.published}</span> published
                        </>
                      )}
                    </>
                  )}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AddTopicForm({ onCreated, onCancel }: { onCreated: (id: string, message: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [suggest, setSuggest] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <Card title="New topic">
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setPending(true);
          try {
            const r = await sendJson<{ topic: { _id: string; title: string }; suggested: number; suggestError?: string }>(
              '/api/topics',
              'POST',
              { title, description, suggest },
            );
            const msg = r.suggestError
              ? `Added "${r.topic.title}". Suggestions failed (${r.suggestError}); use "Suggest subtopics" to retry.`
              : suggest
                ? `Added "${r.topic.title}" with ${r.suggested} suggested subtopics.`
                : `Added "${r.topic.title}".`;
            onCreated(r.topic._id, msg);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setPending(false);
          }
        }}
      >
        <div className="md:col-span-2">
          <label className="label" htmlFor="topic-title">
            What are you learning?
          </label>
          <input
            id="topic-title"
            className="input w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="System design"
            autoFocus
            required
            minLength={2}
          />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="topic-desc">
            Anything to steer it (optional)
          </label>
          <textarea
            id="topic-desc"
            className="input min-h-[72px] w-full"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. the parts that come up in backend interviews, not front-end"
          />
        </div>
        <label className="flex items-start gap-2 text-[14px] md:col-span-2">
          <input type="checkbox" className="mt-1" checked={suggest} onChange={(e) => setSuggest(e.target.checked)} />
          <span>
            Suggest about ten subtopics now
            <span className="t-caption block text-muted">One small model call, roughly a cent. You can add, remove, or ask for more afterwards.</span>
          </span>
        </label>
        {error && (
          <div className="md:col-span-2">
            <Notice kind="error">{error}</Notice>
          </div>
        )}
        <div className="flex gap-2 md:col-span-2">
          <button className="btn btn-primary" type="submit" disabled={pending || title.trim().length < 2}>
            {pending ? (suggest ? 'Creating and suggesting…' : 'Creating…') : 'Create topic'}
          </button>
          <button className="btn btn-quiet" type="button" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
