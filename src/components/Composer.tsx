'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  AiMagicIcon,
  ArrowExpand01Icon,
  ArrowRight01Icon,
  ArrowShrinkIcon,
  ArrowUpRight01Icon,
  Briefcase01Icon,
  Calendar03Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  FishingHookIcon,
  FloppyDiskIcon,
  MagicWand01Icon,
  Message01Icon,
  SmileIcon,
  Undo02Icon,
} from '@hugeicons/core-free-icons';
import { useSession } from './SessionProvider';
import { PublishSlider } from './PublishSlider';
import { sendJson, fmtDate, toLocalInput } from '@/lib/ui';
import { lockPage } from '@/lib/pageLock';
import { LINKEDIN_HARD_CAP, WATERMARK_COST } from '@/lib/watermark';

/**
 * "Write a post": a composer for posts the author writes themselves.
 *
 * - AI can edit the text in their voice (presets or a free instruction);
 *   every edit is undoable, and nothing is saved until they choose to.
 * - Save draft puts it in Drafts (Pending) to finish later; the slider
 *   publishes now or schedules it. Publishing saves the draft first, so a
 *   failed publish still leaves the post in Drafts.
 * - What they type is kept on this device until it is posted, saved or
 *   cleared, so closing the composer by accident loses nothing.
 *
 * Opened from anywhere with openComposer(); mounted once in the app layout.
 */

const OPEN_EVENT = 'composer:open';
export function openComposer() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const TEXT_KEY = 'composer-text';
const WATERMARK_KEY = 'cc_watermark';

type Mode = 'improve' | 'shorter' | 'longer' | 'hook' | 'professional' | 'casual' | 'custom';
const PRESETS: { mode: Exclude<Mode, 'custom'>; label: string; icon: IconSvgElement }[] = [
  { mode: 'improve', label: 'Improve', icon: MagicWand01Icon },
  { mode: 'hook', label: 'Stronger hook', icon: FishingHookIcon },
  { mode: 'shorter', label: 'Shorter', icon: ArrowShrinkIcon },
  { mode: 'longer', label: 'Longer', icon: ArrowExpand01Icon },
  { mode: 'professional', label: 'Professional', icon: Briefcase01Icon },
  { mode: 'casual', label: 'Casual', icon: SmileIcon },
];

type Result =
  | { kind: 'saved'; draftId: string }
  | { kind: 'published'; draftId: string; postUrn: string | null }
  | { kind: 'scheduled'; draftId: string; when: string };

const store = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      // Private mode: nothing kept, nothing else lost.
    }
  },
};

export function Composer() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    setMounted(true);
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="presentation">
          <motion.div
            className="cmp-backdrop"
            aria-hidden
            onClick={() => setOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
          />
          <motion.div
            className="cmp-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cmp-title"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.985 }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }}
          >
            <ComposerBody onClose={() => setOpen(false)} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function ComposerBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { session, signInHref } = useSession();
  const panelRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const aiAbort = useRef<AbortController | null>(null);

  const [text, setText] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [aiBusy, setAiBusy] = useState<Mode | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [ask, setAsk] = useState('');
  const [scheduleOn, setScheduleOn] = useState(false);
  const [when, setWhen] = useState('');
  const [watermark, setWatermark] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const draftIdRef = useRef<string | null>(null);

  // Restore what was being written; lock the page; focus the text at its end.
  useEffect(() => {
    const kept = store.get(TEXT_KEY) ?? '';
    setText(kept);
    setWatermark(store.get(WATERMARK_KEY) === '1');
    const unlock = lockPage();
    const opener = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => {
      const el = textRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(kept.length, kept.length);
    });
    return () => {
      unlock();
      aiAbort.current?.abort();
      opener?.focus?.();
    };
  }, []);

  // Keep the text on this device as it is typed.
  useEffect(() => {
    if (result) return;
    const t = window.setTimeout(() => store.set(TEXT_KEY, text.trim() ? text : null), 250);
    return () => window.clearTimeout(t);
  }, [text, result]);

  // Grow the field with the text, up to the cap set in CSS.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text, result]);

  // Escape closes; Tab stays inside the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (askOpen) {
          setAskOpen(false);
          return;
        }
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const f = [...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, textarea, select, a[href]')].filter(
        (el) => el.offsetParent !== null,
      );
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
        e.preventDefault();
        f[0].focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, askOpen]);

  const trimmed = text.trim();
  const limit = watermark ? LINKEDIN_HARD_CAP - WATERMARK_COST : LINKEDIN_HARD_CAP;
  const over = text.length > limit;
  const scheduled = scheduleOn && Boolean(when);
  const signedIn = session?.signedIn ?? false;

  const rephrase = useCallback(
    async (mode: Mode, instruction?: string) => {
      if (trimmed.length < 20) {
        setAiError('Write a little more first, so AI has something to work with.');
        return;
      }
      setAiError(null);
      setAiNote(null);
      setAiBusy(mode);
      const ctrl = new AbortController();
      aiAbort.current = ctrl;
      try {
        const res = await fetch('/api/compose/rephrase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, mode, instruction: instruction || undefined }),
          signal: ctrl.signal,
        });
        const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (!res.ok || !data.text) throw new Error(data.error || 'AI could not rewrite this. Try again.');
        setHistory((h) => [...h, text]);
        setText(data.text);
        setAiNote(mode === 'custom' ? 'Rewritten as you asked.' : `${PRESETS.find((p) => p.mode === mode)?.label ?? 'Edited'} applied.`);
        if (mode === 'custom') {
          setAsk('');
          setAskOpen(false);
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setAiError((e as Error).message);
      } finally {
        setAiBusy(null);
        aiAbort.current = null;
      }
    },
    [text, trimmed.length],
  );

  const undo = () => {
    if (!history.length) return;
    setText(history[history.length - 1]);
    setHistory(history.slice(0, -1));
    setAiNote(null);
  };

  const finish = (r: Result) => {
    store.set(TEXT_KEY, null);
    setResult(r);
  };

  /** Saves once; publishing after a failed attempt reuses the same draft. */
  const saveDraft = async (): Promise<string> => {
    if (draftIdRef.current) return draftIdRef.current;
    const { draftId } = await sendJson<{ draftId: string }>('/api/compose', 'POST', { body: text });
    draftIdRef.current = draftId;
    return draftId;
  };

  const onSave = async () => {
    if (!trimmed) {
      setError('Write something first.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      finish({ kind: 'saved', draftId: await saveDraft() });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const publishRef = useRef<Result | null>(null);
  const onPublish = async () => {
    if (!trimmed) throw new Error('Write something first.');
    if (over) throw new Error('Too long for LinkedIn.');
    if (!scheduled && !signedIn) throw new Error('Sign in to LinkedIn first.');
    if (scheduleOn && !when) throw new Error('Pick a time first.');
    setError(null);
    const draftId = await saveDraft();
    const r = await sendJson<{ outcome: { status: string; error?: string; postUrn?: string } }>(
      `/api/drafts/${draftId}/approve`,
      'POST',
      { scheduledFor: scheduled ? new Date(when).toISOString() : undefined, watermark },
    );
    if (r.outcome.status === 'failed') throw new Error(r.outcome.error ?? 'Publishing failed.');
    publishRef.current = scheduled
      ? { kind: 'scheduled', draftId, when }
      : { kind: 'published', draftId, postUrn: r.outcome.postUrn ?? null };
  };

  const reset = () => {
    setText('');
    setHistory([]);
    setAiNote(null);
    setAiError(null);
    setError(null);
    setScheduleOn(false);
    setWhen('');
    setResult(null);
    draftIdRef.current = null;
    publishRef.current = null;
    requestAnimationFrame(() => textRef.current?.focus());
  };

  const openDraft = (r: Result) => {
    const status = r.kind === 'saved' ? 'pending' : r.kind === 'scheduled' ? 'approved' : 'published';
    onClose();
    router.push(`/review?draft=${r.draftId}&status=${status}`);
  };

  const member = session?.member;
  const initials = (member?.name ?? 'You')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div ref={panelRef} className="cmp-inner">
      <header className="cmp-head">
        <div className="min-w-0">
          <h2 id="cmp-title" className="t-title">
            Write a post
          </h2>
          <p className="t-caption text-muted">Write it your way, polish it with AI, then post now, schedule it, or save it for later.</p>
        </div>
        <button type="button" className="cmp-icon-btn" onClick={onClose} aria-label="Close">
          <HugeiconsIcon icon={Cancel01Icon} size={20} strokeWidth={1.8} />
        </button>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {result ? (
          <motion.div
            key="done"
            className="cmp-done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <span className={`cmp-done-icon is-${result.kind}`}>
              <HugeiconsIcon
                icon={result.kind === 'saved' ? FloppyDiskIcon : result.kind === 'scheduled' ? Calendar03Icon : CheckmarkCircle02Icon}
                size={30}
                strokeWidth={1.7}
              />
            </span>
            <h3 className="t-title mt-4">
              {result.kind === 'saved' ? 'Saved to Drafts' : result.kind === 'scheduled' ? 'Scheduled' : 'Published to LinkedIn'}
            </h3>
            <p className="t-body-sm mt-1 max-w-sm text-center text-muted">
              {result.kind === 'saved'
                ? 'It is waiting in Drafts under Pending. Finish it, publish it or schedule it whenever you are ready.'
                : result.kind === 'scheduled'
                  ? `It will go out on ${fmtDate(new Date(result.when))}. You can change or cancel it from Drafts.`
                  : 'Your post is live. Engagement will show up in Analytics as it comes in.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {result.kind === 'published' && result.postUrn && (
                <a
                  className="btn btn-quiet"
                  href={`https://www.linkedin.com/feed/update/${result.postUrn}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on LinkedIn
                  <HugeiconsIcon icon={ArrowUpRight01Icon} size={16} strokeWidth={2} />
                </a>
              )}
              <button type="button" className="btn btn-quiet" onClick={() => openDraft(result)}>
                Open in Drafts
              </button>
              <button type="button" className="btn btn-primary" onClick={reset}>
                Write another
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="edit" className="cmp-scroll scroll-slim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="cmp-author">
              {member?.picture ? (
                <Image src={member.picture} alt="" width={40} height={40} className="avatar h-10 w-10 object-cover" unoptimized />
              ) : (
                <span className="avatar h-10 w-10 text-[14px]">{initials}</span>
              )}
              <div className="min-w-0">
                <p className="t-title-sm truncate">{member?.name ?? 'You'}</p>
                <p className="t-caption text-muted">Posting to LinkedIn</p>
              </div>
            </div>

            <div className={`cmp-editor ${aiBusy ? 'is-busy' : ''}`}>
              <textarea
                ref={textRef}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setAiNote(null);
                  if (error) setError(null);
                  if (aiError) setAiError(null);
                }}
                readOnly={Boolean(aiBusy)}
                className="cmp-textarea scroll-slim"
                placeholder="What do you want to share? Write it in your own words; AI can polish it after."
                aria-label="Post text"
                maxLength={LINKEDIN_HARD_CAP}
              />
              {aiBusy && (
                <div className="cmp-busy" role="status">
                  <span className="cmp-busy-icon">
                    <HugeiconsIcon icon={AiMagicIcon} size={18} strokeWidth={1.8} />
                  </span>
                  Rewriting{'…'}
                  <button type="button" className="cmp-link" onClick={() => aiAbort.current?.abort()}>
                    Stop
                  </button>
                </div>
              )}
            </div>

            <div className="cmp-meta">
              <span className="t-caption text-muted">
                {aiNote ? (
                  <span className="cmp-ai-note">
                    <HugeiconsIcon icon={AiMagicIcon} size={14} strokeWidth={1.8} />
                    {aiNote}
                  </span>
                ) : trimmed ? (
                  'Kept on this device until you post or save it.'
                ) : null}
              </span>
              <span className="flex items-center gap-3">
                {history.length > 0 && !aiBusy && (
                  <button type="button" className="cmp-link" onClick={undo}>
                    <HugeiconsIcon icon={Undo02Icon} size={14} strokeWidth={2} />
                    Undo
                  </button>
                )}
                <span className={`cmp-count ${over ? 'is-over' : text.length > limit * 0.9 ? 'is-near' : ''}`}>
                  {text.length.toLocaleString()} / {limit.toLocaleString()}
                </span>
              </span>
            </div>

            <section className="cmp-ai" aria-label="Rephrase with AI">
              <p className="cmp-ai-title">
                <HugeiconsIcon icon={AiMagicIcon} size={16} strokeWidth={1.8} />
                Rephrase with AI
                <span className="t-caption font-normal text-muted">in your voice, nothing invented</span>
              </p>
              <div className="cmp-chips">
                {PRESETS.map((p) => (
                  <button
                    key={p.mode}
                    type="button"
                    className={`cmp-chip ${aiBusy === p.mode ? 'is-busy' : ''}`}
                    disabled={Boolean(aiBusy)}
                    onClick={() => void rephrase(p.mode)}
                  >
                    <HugeiconsIcon icon={p.icon} size={15} strokeWidth={1.8} />
                    {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`cmp-chip ${askOpen ? 'is-on' : ''}`}
                  disabled={Boolean(aiBusy)}
                  onClick={() => setAskOpen((v) => !v)}
                  aria-expanded={askOpen}
                >
                  <HugeiconsIcon icon={Message01Icon} size={15} strokeWidth={1.8} />
                  Ask AI{'…'}
                </button>
              </div>
              <AnimatePresence initial={false}>
                {askOpen && (
                  <motion.form
                    className="cmp-ask"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (ask.trim()) void rephrase('custom', ask.trim());
                    }}
                  >
                    <div className="cmp-ask-row">
                      <input
                        className="input min-w-0 flex-1"
                        value={ask}
                        onChange={(e) => setAsk(e.target.value)}
                        placeholder="e.g. end with a question for the reader"
                        maxLength={300}
                        autoFocus
                        aria-label="What should AI change?"
                      />
                      <button type="submit" className="btn btn-primary btn-sm" disabled={!ask.trim() || Boolean(aiBusy)}>
                        Rewrite
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
              {aiError && (
                <p className="cmp-error" role="alert">
                  {aiError}
                  {/key/i.test(aiError) && (
                    <>
                      {' '}
                      <Link href="/settings" className="cmp-link" onClick={onClose}>
                        Add a key in Settings
                      </Link>
                    </>
                  )}
                </p>
              )}
            </section>

            <p className="cmp-alt">
              Rather have AI research and write one for you?{' '}
              <Link href="/backlog" className="cmp-link" onClick={onClose}>
                Pick a topic
                <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={2} />
              </Link>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {!result && (
        <footer className="cmp-foot">
          <div className="cmp-options">
            <button
              type="button"
              className={`cmp-chip ${scheduleOn ? 'is-on' : ''}`}
              onClick={() => {
                setScheduleOn((v) => !v);
                if (!when) setWhen(toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
              }}
              aria-pressed={scheduleOn}
            >
              <HugeiconsIcon icon={Calendar03Icon} size={15} strokeWidth={1.8} />
              {scheduleOn ? 'Scheduled' : 'Schedule'}
            </button>
            {scheduleOn && (
              <input
                type="datetime-local"
                className="input cmp-when"
                value={when}
                min={toLocalInput(new Date())}
                onChange={(e) => setWhen(e.target.value)}
                aria-label="Publish at"
              />
            )}
            <label className="cmp-check">
              <input
                type="checkbox"
                checked={watermark}
                onChange={(e) => {
                  setWatermark(e.target.checked);
                  store.set(WATERMARK_KEY, e.target.checked ? '1' : '0');
                }}
              />
              Add {'“'}Posted from conceptcast{'”'}
            </label>
          </div>

          {!scheduled && !signedIn && (
            <p className="cmp-note">
              Publishing now needs LinkedIn.{' '}
              <a className="cmp-link" href={signInHref()}>
                Sign in
              </a>{' '}
              or schedule it, or save it as a draft.
            </p>
          )}
          {error && (
            <p className="cmp-error" role="alert">
              {error}
            </p>
          )}

          <div className="cmp-actions">
            <button type="button" className="btn btn-quiet cmp-save" onClick={() => void onSave()} disabled={saving || Boolean(aiBusy)}>
              <HugeiconsIcon icon={FloppyDiskIcon} size={16} strokeWidth={1.8} />
              {saving ? 'Saving…' : 'Save draft'}
            </button>
            <div className="min-w-0 flex-1">
              <PublishSlider
                height={48}
                label={scheduled ? 'Slide to schedule' : 'Slide to publish'}
                doneLabel={scheduled ? 'Scheduled' : 'Published'}
                errorLabel={
                  !trimmed
                    ? 'Write something first'
                    : over
                      ? 'Too long for LinkedIn'
                      : !scheduled && !signedIn
                        ? 'Sign in to LinkedIn first'
                        : 'Publishing failed'
                }
                onConfirm={onPublish}
                onDone={() => window.setTimeout(() => publishRef.current && finish(publishRef.current), 900)}
                onError={(e) =>
                  setError(
                    `${(e as Error).message}${draftIdRef.current ? ' Your post is saved in Drafts, so nothing is lost.' : ''}`,
                  )
                }
              />
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
