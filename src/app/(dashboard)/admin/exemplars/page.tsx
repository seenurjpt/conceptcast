'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getJson, sendJson } from '@/lib/ui';
import { ActionButton, Card, EmptyState, Notice, PageHeader } from '@/components/ui';

interface ArchetypeRow {
  slug: string;
  name: string;
  description: string;
  slots: string[];
  requiresFirsthandEvidence: boolean;
  count: number;
}

interface ExemplarRow {
  _id: string;
  archetypeSlug: string;
  authorHandle: string;
  rawText: string;
  charCount: number;
  annotations: { hook: string; sections: Record<string, string>; whyItWorks: string };
  createdAt: string;
}

interface Listing {
  minPerArchetype: number;
  archetypes: ArchetypeRow[];
  exemplars: ExemplarRow[];
}

const AUTHOR_KEY = 'cc_exemplar_author';

export default function ExemplarsAdminPage() {
  const [data, setData] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [slug, setSlug] = useState('');
  const [author, setAuthor] = useState('');
  const [rawText, setRawText] = useState('');
  const [hook, setHook] = useState('');
  const [sections, setSections] = useState<Record<string, string>>({});
  const [why, setWhy] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await getJson<Listing>('/api/admin/exemplars');
      setData(r);
      setSlug((s) => s || r.archetypes[0]?.slug || '');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
    try {
      setAuthor(localStorage.getItem(AUTHOR_KEY) ?? '');
    } catch {
      /* private mode */
    }
  }, [load]);

  const archetype = useMemo(() => data?.archetypes.find((a) => a.slug === slug) ?? null, [data, slug]);
  const charCount = rawText.normalize('NFC').length;

  const useFirstLineAsHook = () => {
    const first = rawText.split('\n').find((l) => l.trim().length > 0) ?? '';
    setHook(first.trim());
  };

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!archetype) return;
    const missing = archetype.slots.filter((s) => !(sections[s] ?? '').trim());
    if (!hook.trim()) throw new Error('Mark the hook: the first line a reader sees.');
    if (missing.length) throw new Error(`Paste the text for every slot; missing: ${missing.join(', ')}.`);
    try {
      localStorage.setItem(AUTHOR_KEY, author);
    } catch {
      /* ignore */
    }
    const r = await sendJson<{ count: number }>('/api/admin/exemplars', 'POST', {
      archetypeSlug: slug,
      authorHandle: author,
      rawText,
      annotations: { hook: hook.trim(), sections, whyItWorks: why },
    });
    setNotice(`Saved. ${archetype.name} now has ${r.count} exemplar${r.count === 1 ? '' : 's'}.`);
    setRawText('');
    setHook('');
    setSections({});
    setWhy('');
    await load();
  };

  const remove = async (id: string) => {
    await sendJson(`/api/admin/exemplars/${id}`, 'DELETE');
    await load();
  };

  return (
    <>
      <PageHeader
        title="Exemplars"
        subtitle="Real posts, one archetype each. The writer sees three of these per run and copies their shape, so pick posts you would be proud to have written."
      />

      <div className="space-y-3">
        {error && (
          <Notice kind="error" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        )}
        {notice && (
          <Notice kind="ok" onDismiss={() => setNotice(null)}>
            {notice}
          </Notice>
        )}
      </div>

      {data && (
        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card title="Add an exemplar">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="t-caption text-muted">Archetype</span>
                <select className="input mt-1 w-full" value={slug} onChange={(e) => setSlug(e.target.value)}>
                  {data.archetypes.map((a) => (
                    <option key={a.slug} value={a.slug}>
                      {a.name} ({a.count}/{data.minPerArchetype})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="t-caption text-muted">Author handle</span>
                <input className="input mt-1 w-full" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="@someone" />
              </label>
            </div>
            {archetype && <p className="t-body-sm mt-2 text-body">{archetype.description}</p>}

            <label className="mt-4 block">
              <span className="t-caption text-muted">Post text, exactly as published · {charCount} chars</span>
              <textarea
                className="input mt-1 min-h-[220px] w-full font-mono text-sm"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste the full post here."
              />
            </label>

            <div className="mt-4 flex items-end gap-2">
              <label className="block flex-1">
                <span className="t-caption text-muted">Hook (the first line the reader sees)</span>
                <input className="input mt-1 w-full" value={hook} onChange={(e) => setHook(e.target.value)} />
              </label>
              <button type="button" className="btn btn-sm" onClick={useFirstLineAsHook} disabled={!rawText.trim()}>
                Use first line
              </button>
            </div>

            {archetype && (
              <fieldset className="mt-4">
                <legend className="t-caption text-muted">Section boundaries: paste the part of the post that fills each slot</legend>
                <div className="mt-1 grid gap-3 sm:grid-cols-2">
                  {archetype.slots.map((s) => (
                    <label key={s} className="block">
                      <span className="t-caption">{s}</span>
                      <textarea
                        className="input mt-1 min-h-[72px] w-full text-sm"
                        value={sections[s] ?? ''}
                        onChange={(e) => setSections((prev) => ({ ...prev, [s]: e.target.value }))}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <label className="mt-4 block">
              <span className="t-caption text-muted">Why it works</span>
              <textarea className="input mt-1 min-h-[72px] w-full text-sm" value={why} onChange={(e) => setWhy(e.target.value)} />
            </label>

            <div className="mt-4 flex justify-end">
              <ActionButton
                className="btn btn-primary"
                pendingLabel="Saving…"
                disabled={!archetype || !rawText.trim() || !author.trim()}
                onClick={async () => {
                  try {
                    await submit();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Save exemplar
              </ActionButton>
            </div>
          </Card>

          <div className="space-y-4">
            <Card title="Coverage">
              <ul className="space-y-2">
                {data.archetypes.map((a) => {
                  const ready = a.count >= data.minPerArchetype;
                  return (
                    <li key={a.slug} className="flex items-center justify-between gap-3">
                      <span className="t-body-sm">{a.name}</span>
                      <span className={`t-caption ${ready ? 'text-up' : 'text-attention'}`}>
                        {a.count}/{data.minPerArchetype} {ready ? 'ready' : 'blocked'}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="t-caption mt-3 text-muted">
                The pipeline refuses to write for an archetype with fewer than {data.minPerArchetype} exemplars.
              </p>
            </Card>

            <Card title={`Saved · ${data.exemplars.length}`} flush>
              {data.exemplars.length === 0 ? (
                <EmptyState title="No exemplars yet" />
              ) : (
                <ul className="divide-y divide-hairline">
                  {data.exemplars.map((e) => (
                    <li key={e._id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="t-caption text-muted">
                          {e.archetypeSlug} · {e.authorHandle} · {e.charCount} chars
                        </div>
                        <div className="t-body-sm mt-1 truncate" title={e.annotations.hook}>
                          {e.annotations.hook}
                        </div>
                      </div>
                      <ActionButton className="btn btn-sm" confirm="Delete this exemplar?" onClick={() => remove(e._id)}>
                        Delete
                      </ActionButton>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
