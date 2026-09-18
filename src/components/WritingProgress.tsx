'use client';

import { useEffect, useState } from 'react';

/**
 * In-flight view for a pipeline run. The request is one long POST, so there
 * is no live stage signal; the timeline below is estimated from elapsed time
 * and says so. The bar eases toward, but never reaches, the end until the
 * caller unmounts it: a full bar that then keeps spinning is worse than an
 * honest 90%.
 */

interface Stage {
  key: string;
  label: string;
  /** Seconds after start when this stage typically begins. */
  startsAt: number;
  messages: string[];
}

const STAGES: Stage[] = [
  {
    key: 'research',
    label: 'Research',
    startsAt: 0,
    messages: [
      'Fetching the primary sources',
      'Reading the papers and docs',
      'Pulling out the mechanism and the numbers',
      'Listing the misconceptions worth correcting',
    ],
  },
  {
    key: 'write',
    label: 'Write',
    startsAt: 95,
    messages: ['Drafting three angles in your voice', 'Tightening the hook to the mobile fold', 'Choosing the one idea per post'],
  },
  {
    key: 'critique',
    label: 'Critique',
    startsAt: 135,
    messages: ['Scoring each draft against the rubric', 'Checking every number has a source', 'Picking the winner, one revision if it is close'],
  },
];

/** Typical total; past this the bar just holds near the end. */
const EXPECTED_SECONDS = 190;

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function WritingProgress({ title, startedAt }: { title: string; startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const activeIdx = STAGES.reduce((acc, s, i) => (elapsed >= s.startsAt ? i : acc), 0);
  const active = STAGES[activeIdx];
  const message = active.messages[Math.floor(elapsed / 12) % active.messages.length];

  // Ease-out toward 92%; overtime creeps to 97% and stops.
  const ratio = Math.min(elapsed / EXPECTED_SECONDS, 1);
  const eased = 1 - Math.pow(1 - ratio, 2);
  const overtime = elapsed > EXPECTED_SECONDS ? Math.min((elapsed - EXPECTED_SECONDS) / 120, 1) * 5 : 0;
  const percent = Math.min(92 * eased + overtime, 97);

  return (
    <div className="writing mt-3 w-full" role="status" aria-live="polite" aria-label={`Writing a post about ${title}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="writing-orb" aria-hidden="true" />
          <span className="t-body-sm truncate text-body">
            <span className="text-ink">{message}</span>
            <span className="text-muted">…</span>
          </span>
        </div>
        <span className="t-number t-caption shrink-0 tabular-nums text-muted" title="Elapsed">
          {fmt(elapsed)}
          {elapsed > EXPECTED_SECONDS + 60 && <span className="ml-2 text-attention">taking longer than usual</span>}
        </span>
      </div>

      <div className="writing-bar mt-2" aria-hidden="true">
        <div className="writing-bar-fill" style={{ width: `${percent}%` }} />
      </div>

      <ol className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {STAGES.map((s, i) => {
          const state = i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'todo';
          return (
            <li key={s.key} className={`writing-stage writing-stage-${state} t-caption flex items-center gap-1.5`}>
              <span className="writing-dot" aria-hidden="true">
                {state === 'done' && (
                  <svg viewBox="0 0 10 10" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 5.2 4.2 7.4 8 3" />
                  </svg>
                )}
              </span>
              {s.label}
            </li>
          );
        })}
        <li className="t-caption ml-auto text-muted-soft">Stages are estimated from elapsed time.</li>
      </ol>
    </div>
  );
}
