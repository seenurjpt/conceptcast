'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendJson } from '@/lib/ui';
import { WritingProgress } from './WritingProgress';
import { ActionButton, TrackBadge } from './ui';

export interface Subtopic {
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
  origin?: 'seed' | 'proposal' | 'news' | 'user' | 'suggested';
  storyDate?: string | null;
}

/** "3d old" style age for news topics; null when there is no story date. */
function storyAge(d: string | null | undefined): string | null {
  if (!d) return null;
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  return days <= 0 ? 'today' : `${days}d old`;
}

/**
 * One subtopic: title, what it is about, and the one action that matters.
 *
 * Migrated AI-dev rows still carry prerequisites, difficulty, relevance and
 * hand-picked sources, so they show them. A subtopic you or the model added
 * has none of that, and the row does not pretend otherwise.
 */
export function SubtopicRow({
  c,
  publishedSlugs,
  run,
}: {
  c: Subtopic;
  publishedSlugs: Set<string>;
  run: (fn: () => Promise<string | void>) => Promise<void>;
}) {
  const router = useRouter();
  const showMetadata = c.origin === 'seed' || c.origin === 'proposal' || c.origin === 'news';
  const [rel, setRel] = useState(String(c.devRelevance));
  /** Epoch ms when a run started from this row; null when idle. Drives the progress view. */
  const [writingSince, setWritingSince] = useState<number | null>(null);
  useEffect(() => setRel(String(c.devRelevance)), [c.devRelevance]);
  const unmet = showMetadata ? c.prerequisites.filter((p) => !publishedSlugs.has(p)) : [];
  const eligible = c.status === 'backlog' && unmet.length === 0;
  const summary = c.oneLiner || c.focus;

  return (
    <li className={`row flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-4${writingSince ? ' writing-row' : ''}`}>
      <div className="min-w-0 flex-1 sm:min-w-[240px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="t-title-sm">{c.title}</span>
          {showMetadata && <TrackBadge track={c.track} />}
          {c.status !== 'backlog' && (
            <span className={`badge ${c.status === 'published' ? 'badge-up' : c.status === 'selected' ? 'badge-primary' : 'badge-quiet'}`}>
              {c.status}
            </span>
          )}
          {c.origin === 'suggested' && <span className="badge badge-quiet">suggested</span>}
          {c.origin === 'news' && (
            <span className="badge badge-attention" title={c.note ?? undefined}>
              news{storyAge(c.storyDate) ? ` · ${storyAge(c.storyDate)}` : ''}
            </span>
          )}
          {c.timelinessBoost > 0 && <span className="badge badge-attention">in the news +{c.timelinessBoost}</span>}
          {eligible && showMetadata && <span className="badge badge-quiet">ready</span>}
        </div>
        {summary && <p className="t-body-sm mt-0.5 text-body">{summary}</p>}
        {unmet.length > 0 && <p className="t-caption mt-1 text-muted">Waiting on {unmet.join(', ')}</p>}
        {c.note && <p className="t-caption mt-1 text-attention">{c.note}</p>}
        {(showMetadata || c.primarySources.length > 0) && (
          <div className="t-caption mt-1 flex flex-wrap gap-x-3 text-muted">
            {showMetadata && <span>Difficulty {c.difficulty}</span>}
            {c.primarySources.map((s, i) => (
              <a key={i} className="text-primary hover:underline" href={s.url} target="_blank" rel="noreferrer">
                {s.type}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Wraps rather than clipping on narrow screens or enlarged fonts. */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:w-full">
        {showMetadata && (
          <>
            <label htmlFor={`rel-${c.slug}`} className="t-caption shrink-0 text-muted sm:sr-only">
              Relevance
            </label>
            <input
              id={`rel-${c.slug}`}
              className="input t-number h-9 w-14 shrink-0 px-2 text-center text-[13px] text-muted sm:h-8"
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={rel}
              title={`How relevant "${c.title}" is to your audience, 0 to 10. Used when suggesting what to write next.`}
              aria-label={`Relevance for ${c.title}, 0 to 10`}
              onChange={(e) => setRel(e.target.value)}
              onBlur={() => {
                const n = Number(rel);
                if (!Number.isFinite(n) || n === c.devRelevance) return;
                void run(async () => {
                  await sendJson(`/api/concepts/${c.slug}`, 'PATCH', { devRelevance: Math.max(0, Math.min(10, n)) });
                });
              }}
            />
          </>
        )}
        {c.status !== 'retired' && c.status !== 'published' && (
          <ActionButton
            className="btn btn-primary btn-sm max-sm:min-w-[7.5rem] max-sm:flex-1"
            pendingLabel="Writing…"
            title={eligible ? 'Research, draft and critique this now' : 'Its prerequisites are not published yet, but it will still run'}
            confirm={{
              title: `Write a post about "${c.title}"?`,
              body: 'It searches the web, drafts three angles, and critiques them. About three minutes and roughly $0.30 in tokens. The draft opens for review when it is done.',
              confirmLabel: 'Write it',
            }}
            onClick={async () => {
              setWritingSince(Date.now());
              try {
                await run(async () => {
                  const r = await sendJson<{ queued: boolean; result?: { status: string; score: number; draftId: string } }>(
                    `/api/concepts/${c.slug}/generate`,
                    'POST',
                    { force: c.status !== 'backlog' },
                  );
                  if (r.queued) return `Queued ${c.title}.`;
                  if (r.result?.status === 'pass') {
                    router.push(`/review?draft=${r.result.draftId}`);
                    return `Drafted "${c.title}", scored ${r.result.score}/10.`;
                  }
                  return `"${c.title}" scored ${r.result?.score}/10 and did not pass the critic, so it was discarded. Try again, or pick another subtopic.`;
                });
              } finally {
                setWritingSince(null);
              }
            }}
          >
            Write a post
          </ActionButton>
        )}
        {c.status === 'backlog' && (
          <ActionButton
            className="btn btn-quiet btn-sm"
            onClick={() =>
              run(async () => {
                await sendJson(`/api/concepts/${c.slug}`, 'DELETE');
                return `Removed "${c.title}".`;
              })
            }
          >
            Remove
          </ActionButton>
        )}
        {c.status === 'retired' && (
          <ActionButton
            className="btn btn-quiet btn-sm"
            onClick={() =>
              run(async () => {
                await sendJson(`/api/concepts/${c.slug}`, 'PATCH', { status: 'backlog' });
                return `Restored "${c.title}".`;
              })
            }
          >
            Restore
          </ActionButton>
        )}
      </div>
      {writingSince !== null && <WritingProgress title={c.title} startedAt={writingSince} />}
    </li>
  );
}
