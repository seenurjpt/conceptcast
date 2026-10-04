'use client';

import { useCallback, useEffect, useState } from 'react';
import { getJson, sendJson } from '@/lib/ui';
import { Card } from '@/components/ui';

interface Prefs {
  researchPoolSize: number;
  maxResearchPoolSize: number;
  pool: { disabled: 'off' | 'no-key' | null; ready: number; running: number; queued: number };
}

/**
 * How many subtopics to keep researched in the background. Research costs
 * tokens on the author's key before they click, so the size is theirs to set.
 */
export function ResearchPoolCard({ onMessage }: { onMessage: (msg: string, kind: 'ok' | 'error') => void }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setPrefs(await getJson<Prefs>('/api/user/prefs'));
    } catch (e) {
      onMessage((e as Error).message, 'error');
    }
  }, [onMessage]);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async (size: number) => {
    setSaving(true);
    try {
      setPrefs(await sendJson<Prefs>('/api/user/prefs', 'PUT', { researchPoolSize: size }));
      onMessage(size === 0 ? 'Background research is off.' : `Keeping your top ${size} subtopics researched.`, 'ok');
    } catch (e) {
      onMessage((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const status = (() => {
    if (!prefs) return null;
    const { pool } = prefs;
    if (pool.disabled === 'off') return 'Off. Every post is researched when you click Write.';
    if (pool.disabled === 'no-key') return 'Waiting for an API key above. Nothing is researched without one.';
    const parts = [`${pool.ready} ready`];
    if (pool.running) parts.push(`${pool.running} researching now`);
    if (pool.queued) parts.push(`${pool.queued} waiting`);
    return parts.join(', ');
  })();

  return (
    <Card title="Background research">
      <p className="t-body-sm text-body">
        Your top subtopics are researched ahead of time, so writing one takes under two minutes instead of about three.
        Subtopics you add yourself are researched when you click Write.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="label mb-0" htmlFor="pool-size">
          Keep researched
        </label>
        <select
          id="pool-size"
          className="input w-auto"
          value={prefs?.researchPoolSize ?? 5}
          disabled={!prefs || saving}
          onChange={(e) => void save(Number(e.target.value))}
        >
          {Array.from({ length: (prefs?.maxResearchPoolSize ?? 10) + 1 }, (_, n) => (
            <option key={n} value={n}>
              {n === 0 ? 'Off' : `Top ${n}`}
            </option>
          ))}
        </select>
        {status && <span className="t-caption text-muted">{status}</span>}
      </div>
      <p className="t-caption mt-2 text-muted">
        Each research costs roughly $0.10 to $0.15 on your key. The pool refills by one each time you write a post, so it
        costs about the same as researching on click, just earlier.
      </p>
    </Card>
  );
}
