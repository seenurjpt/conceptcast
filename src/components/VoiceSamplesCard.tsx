'use client';

import { useCallback, useEffect, useState } from 'react';
import { getJson, sendJson, fmtRelative } from '@/lib/ui';
import { ActionButton, Card } from '@/components/ui';

interface Sample {
  _id: string;
  text: string;
  source: string;
  createdAt: string;
}

interface Listing {
  samples: Sample[];
  count: number;
  minForExtract: number;
  activeProfile: { version: number; createdAt: string; profile: { rawNotes: string } } | null;
}

const SOURCES = ['post', 'slack', 'pr', 'chat', 'other'] as const;

/**
 * Voice samples feed the versioned voice_profiles used by the post pipeline
 * (distinct from the legacy style guide above). Ten samples unlock extraction.
 */
export function VoiceSamplesCard({ onMessage }: { onMessage: (msg: string, kind: 'ok' | 'error') => void }) {
  const [data, setData] = useState<Listing | null>(null);
  const [text, setText] = useState('');
  const [source, setSource] = useState<(typeof SOURCES)[number]>('post');

  const load = useCallback(async () => {
    try {
      setData(await getJson<Listing>('/api/voice/samples'));
    } catch (e) {
      onMessage((e as Error).message, 'error');
    }
  }, [onMessage]);
  useEffect(() => {
    void load();
  }, [load]);

  const count = data?.count ?? 0;
  const min = data?.minForExtract ?? 10;

  return (
    <Card
      title="Voice profile (pipeline)"
      action={
        data?.activeProfile ? (
          <span className="t-caption text-muted">
            v{data.activeProfile.version} · {fmtRelative(data.activeProfile.createdAt)}
          </span>
        ) : (
          <span className="t-caption text-muted">no profile yet</span>
        )
      }
    >
      <p className="t-body-sm text-body">
        Paste anything you wrote: posts, Slack messages, PR descriptions. {count}/{min} samples collected.
      </p>
      <textarea
        className="input mt-3 w-full min-h-[120px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="One sample at a time. Twenty characters minimum."
        aria-label="Voice sample"
      />
      {/* The select keeps its own width; the buttons share what's left rather
          than being squeezed to one word each. */}
      <div className="mt-2 flex flex-wrap items-center gap-2 max-sm:[&>button]:flex-1">
        <select
          className="input w-auto shrink-0"
          value={source}
          onChange={(e) => setSource(e.target.value as (typeof SOURCES)[number])}
          aria-label="Source"
        >
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <ActionButton
          className="btn"
          disabled={text.trim().length < 20}
          pendingLabel="Saving…"
          onClick={async () => {
            try {
              await sendJson('/api/voice/samples', 'POST', { text, source });
              setText('');
              await load();
              onMessage('Sample saved.', 'ok');
            } catch (e) {
              onMessage((e as Error).message, 'error');
            }
          }}
        >
          Add sample
        </ActionButton>
        <ActionButton
          className="btn btn-primary"
          disabled={count < min}
          pendingLabel="Queuing…"
          title={count < min ? `Needs ${min - count} more sample${min - count === 1 ? '' : 's'}` : undefined}
          onClick={async () => {
            try {
              await sendJson('/api/voice/extract', 'POST', {});
              onMessage('Voice extraction queued. A new profile version appears here when it finishes.', 'ok');
            } catch (e) {
              onMessage((e as Error).message, 'error');
            }
          }}
        >
          Extract profile
        </ActionButton>
      </div>
      {data && data.samples.length > 0 && (
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto">
          {data.samples
            .slice()
            .reverse()
            .map((s) => (
              <li key={s._id} className="t-caption truncate text-muted" title={s.text}>
                <span className="text-body">{s.source}</span> · {s.text.replace(/\s+/g, ' ').slice(0, 110)}
              </li>
            ))}
        </ul>
      )}
    </Card>
  );
}
