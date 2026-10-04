'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getJson, sendJson } from '@/lib/ui';
import { SubtopicRow, type Subtopic } from '@/components/SubtopicRow';
import { researchBadge } from '@/lib/research/pool';
import { ActionButton, Card, EmptyState, Notice, PageHeader, Segmented, Stat } from '@/components/ui';

interface Topic {
  _id: string;
  slug: string;
  title: string;
  description: string;
  origin: 'migrated' | 'user';
}
type StatusFilter = 'backlog' | 'selected' | 'published' | 'retired' | 'all';

export default function TopicPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const router = useRouter();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [status, setStatus] = useState<StatusFilter>('backlog');
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await getJson<{ topic: Topic; subtopics: Subtopic[] }>(`/api/topics/${topicId}`);
      setTopic(r.topic);
      setSubtopics(r.subtopics);
    } catch (e) {
      const msg = (e as Error).message;
      if (/not found/i.test(msg)) setMissing(true);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }, [topicId]);
  useEffect(() => {
    void load();
  }, [load]);

  // While background research runs, refetch quietly so "researching" turns
  // into "researched" without a reload. Stops once nothing is running.
  const anyResearching = useMemo(() => subtopics.some((c) => researchBadge(c) === 'running'), [subtopics]);
  useEffect(() => {
    if (!anyResearching) return;
    const id = setInterval(() => void load(), 15_000);
    return () => clearInterval(id);
  }, [anyResearching, load]);

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
    () => new Set(subtopics.filter((c) => c.status === 'published').map((c) => c.slug)),
    [subtopics],
  );
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of subtopics) m[c.status] = (m[c.status] ?? 0) + 1;
    return m;
  }, [subtopics]);
  const visible = useMemo(
    () =>
      subtopics.filter(
        (c) =>
          (status === 'all' || c.status === status) &&
          (!q || `${c.title} ${c.oneLiner} ${c.focus}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [subtopics, status, q],
  );

  if (missing) {
    return (
      <EmptyState title="That topic is not here">
        <span className="block">It may have been archived.</span>
        <Link href="/backlog" className="btn btn-primary btn-sm mt-4">
          Back to topics
        </Link>
      </EmptyState>
    );
  }

  return (
    <>
      <Link href="/backlog" className="t-caption mb-3 inline-flex items-center gap-1 text-muted hover:text-ink">
        ← Topics
      </Link>
      <PageHeader
        title={topic?.title ?? '…'}
        subtitle={topic?.description || 'Pick a subtopic and write a post. About three minutes each; the draft opens for your review.'}
        actions={
          <>
            <ActionButton
              className="btn"
              pendingLabel="Suggesting…"
              disabled={!topic}
              confirm={{
                title: 'Suggest more subtopics?',
                body: 'One small model call, roughly a cent. It skips anything already listed here.',
                confirmLabel: 'Suggest',
              }}
              onClick={() =>
                run(async () => {
                  const r = await sendJson<{ added: Subtopic[]; skipped: number }>(`/api/topics/${topicId}/suggest`, 'POST');
                  return r.added.length
                    ? `Added ${r.added.length} subtopic${r.added.length === 1 ? '' : 's'}${r.skipped ? `, skipped ${r.skipped} duplicate${r.skipped === 1 ? '' : 's'}` : ''}.`
                    : 'Nothing new to add; everything it proposed was already here.';
                })
              }
            >
              Suggest subtopics
            </ActionButton>
            <button className="btn btn-primary" onClick={() => setShowAdd((v) => !v)} disabled={!topic}>
              {showAdd ? 'Close' : 'Add subtopic'}
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
          <AddSubtopicForm
            topicId={topicId}
            onDone={(title) => {
              setShowAdd(false);
              void run(async () => `Added "${title}".`);
            }}
            onCancel={() => setShowAdd(false)}
          />
        </div>
      )}

      <Card className="mt-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
          <Stat label="To write" value={counts.backlog ?? 0} />
          <Stat label="Drafted" value={(counts.selected ?? 0) + (counts.published ?? 0)} />
          <Stat label="Published" value={counts.published ?? 0} tone={counts.published ? 'up' : undefined} />
          <Stat label="Removed" value={counts.retired ?? 0} />
        </div>
      </Card>

      <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-3">
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: 'backlog', label: 'To write', count: counts.backlog ?? 0 },
            { value: 'selected', label: 'In flight', count: counts.selected ?? 0 },
            { value: 'published', label: 'Published', count: counts.published ?? 0 },
            { value: 'retired', label: 'Removed', count: counts.retired ?? 0 },
            { value: 'all', label: 'All', count: subtopics.length },
          ]}
        />
        <input
          className="input h-9 w-full text-[13px] sm:ml-auto sm:w-56"
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search subtopics"
        />
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="card h-64 animate-pulse" />
        ) : subtopics.length === 0 ? (
          <EmptyState title="No subtopics yet">
            <span className="block">Ask for suggestions, or add one by hand.</span>
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState title="Nothing matches">Try a different filter.</EmptyState>
        ) : (
          <ul className="card-flush row-list px-4 sm:px-5">
            {visible.map((c) => (
              <SubtopicRow key={c._id} c={c} publishedSlugs={publishedSlugs} run={run} />
            ))}
          </ul>
        )}
      </div>

      {topic?.origin === 'user' && (
        <div className="mt-8 border-t border-hairline pt-4">
          <ActionButton
            className="btn btn-danger btn-sm"
            confirm={{
              title: `Archive "${topic.title}"?`,
              body: 'It disappears from your list and its unwritten subtopics are removed. Drafts and published posts are kept.',
              confirmLabel: 'Archive',
              danger: true,
            }}
            onClick={async () => {
              await sendJson(`/api/topics/${topicId}`, 'DELETE');
              router.push('/backlog');
            }}
          >
            Archive this topic
          </ActionButton>
        </div>
      )}
    </>
  );
}

function AddSubtopicForm({ topicId, onDone, onCancel }: { topicId: string; onDone: (title: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [focus, setFocus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <Card title="New subtopic">
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setPending(true);
          try {
            await sendJson(`/api/topics/${topicId}/subtopics`, 'POST', { title, focus: focus || undefined });
            onDone(title);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setPending(false);
          }
        }}
      >
        <div className="md:col-span-2">
          <label className="label" htmlFor="sub-title">
            Subtopic
          </label>
          <input
            id="sub-title"
            className="input w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Consistent hashing"
            autoFocus
            required
            minLength={3}
          />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="sub-focus">
            What to dig into (optional)
          </label>
          <input
            id="sub-focus"
            className="input w-full"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="Why only 1/N keys move when a node leaves, and what virtual nodes fix"
          />
          <p className="t-caption mt-1.5 text-muted">One line for the researcher. Leave it blank and the title is used.</p>
        </div>
        {error && (
          <div className="md:col-span-2">
            <Notice kind="error">{error}</Notice>
          </div>
        )}
        <div className="flex gap-2 md:col-span-2">
          <button className="btn btn-primary" type="submit" disabled={pending || title.trim().length < 3}>
            {pending ? 'Adding…' : 'Add subtopic'}
          </button>
          <button className="btn btn-quiet" type="button" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
