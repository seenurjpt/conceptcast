'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Bookmark02Icon,
  Cancel01Icon,
  Clock01Icon,
  CornerDownLeftIcon,
  FileEditIcon,
  Layers01Icon,
  Moon02Icon,
  Note01Icon,
  PencilEdit02Icon,
  Search01Icon,
  SearchRemoveIcon,
  SentIcon,
} from '@hugeicons/core-free-icons';
import { NAV_GROUPS, SETTINGS } from './Sidebar';
import { lockPage } from '@/lib/pageLock';
import type { SearchHit, SearchKind } from '@/app/api/search/route';

/**
 * The global search: a command palette opened from the top bar, with
 * Ctrl+K / Cmd+K, or "/" anywhere outside a text field.
 *
 * Pages and actions are matched on the client, instantly. Records (topics,
 * subtopics, drafts, published posts, exemplars) come from /api/search,
 * debounced, with the previous request cancelled and answers cached for
 * the time the palette is open, so typing back over a query costs nothing.
 */

type Row = {
  key: string;
  icon: IconSvgElement;
  title: string;
  context?: string | null;
  snippet?: string | null;
  status?: string | null;
  href?: string;
  action?: () => void;
  /** Saved to recents when opened. */
  hit?: SearchHit;
};
type Group = { label: string; rows: Row[] };

const KIND: Record<SearchKind, { label: string; icon: IconSvgElement }> = {
  topic: { label: 'Topics', icon: Layers01Icon },
  subtopic: { label: 'Subtopics', icon: Note01Icon },
  draft: { label: 'Drafts', icon: FileEditIcon },
  published: { label: 'Published', icon: SentIcon },
  exemplar: { label: 'Exemplars', icon: Bookmark02Icon },
};
const KIND_ORDER: SearchKind[] = ['topic', 'subtopic', 'draft', 'published', 'exemplar'];

const RECENT_KEY = 'search-recent';
const RECENT_MAX = 5;
const DEBOUNCE_MS = 140;

function readRecent(): SearchHit[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? v.slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}
function saveRecent(hit: SearchHit) {
  try {
    const next = [hit, ...readRecent().filter((h) => !(h.id === hit.id && h.kind === hit.kind))].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Private mode: no recents, nothing else lost.
  }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `text` with every query word wrapped in <mark>. */
function Highlight({ text, words }: { text: string; words: string[] }) {
  if (!words.length) return <>{text}</>;
  const re = new RegExp(`(${words.map(escapeRe).join('|')})`, 'gi');
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="cp-mark">
            {p}
          </mark>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

function useIsMac() {
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)), []);
  return mac;
}

/** The top bar's search trigger, plus the shortcut and the palette itself. */
export function SearchTrigger() {
  const [open, setOpen] = useState(false);
  const mac = useIsMac();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button type="button" className="cp-trigger" onClick={() => setOpen(true)} aria-label="Search" aria-haspopup="dialog">
        <HugeiconsIcon icon={Search01Icon} size={18} strokeWidth={1.8} />
        <span className="cp-trigger-text">Search{'…'}</span>
        <kbd className="cp-trigger-kbd">{mac ? '⌘' : 'Ctrl'} K</kbd>
      </button>
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const reduce = useReducedMotion();
  if (!mounted) return null;
  // Portalled to <body>: the top bar's backdrop blur makes it the containing
  // block for fixed children, which would pin the palette inside the bar.
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="presentation">
          <motion.div
            className="cp-backdrop"
            onClick={onClose}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
          />
          <motion.div
            className="cp-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985 }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 38 }}
          >
            <PaletteBody onClose={onClose} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const cache = useRef(new Map<string, SearchHit[]>());
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [hitsFor, setHitsFor] = useState('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<SearchHit[]>([]);

  const query = q.trim();
  const words = useMemo(() => query.split(/\s+/).filter(Boolean), [query]);

  // Lock the page, focus the field, and give focus back on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const unlock = lockPage();
    setRecent(readRecent());
    inputRef.current?.focus();
    return () => {
      unlock();
      opener?.focus?.();
    };
  }, []);

  // Records: debounced, the previous request aborted, answers cached.
  useEffect(() => {
    if (query.length < 2) {
      setLoading(false);
      setFailed(false);
      return;
    }
    const key = query.toLowerCase();
    const cached = cache.current.get(key);
    if (cached) {
      setHits(cached);
      setHitsFor(query);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { hits: SearchHit[] };
        cache.current.set(key, data.hits);
        setHits(data.hits);
        setHitsFor(query);
        setFailed(false);
        setLoading(false);
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setFailed(true);
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const toggleTheme = useCallback(() => {
    const root = document.documentElement;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      // The switch still applies to this page.
    }
  }, []);

  const groups: Group[] = useMemo(() => {
    const pages: Row[] = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS].map((p) => ({
      key: `page:${p.href}`,
      icon: p.icon,
      title: p.label,
      href: p.href,
    }));
    const actions: Row[] = [
      { key: 'act:write', icon: PencilEdit02Icon, title: 'Write a post', context: 'Pick a topic and subtopic', href: '/backlog' },
      { key: 'act:theme', icon: Moon02Icon, title: 'Switch theme', context: 'Light or dark', action: toggleTheme },
    ];
    const toRow = (h: SearchHit, icon?: IconSvgElement): Row => ({
      key: `${h.kind}:${h.id}`,
      icon: icon ?? KIND[h.kind].icon,
      title: h.title,
      context: h.context,
      snippet: h.snippet,
      status: h.status,
      href: h.href,
      hit: h,
    });

    if (!query) {
      const out: Group[] = [];
      if (recent.length) out.push({ label: 'Recent', rows: recent.map((h) => toRow(h, Clock01Icon)) });
      out.push({ label: 'Jump to', rows: pages });
      out.push({ label: 'Actions', rows: actions });
      return out;
    }

    const lw = words.map((w) => w.toLowerCase());
    const local = [...pages, ...actions].filter((r) => {
      const hay = `${r.title} ${r.context ?? ''}`.toLowerCase();
      return lw.every((w) => hay.includes(w));
    });
    const out: Group[] = [];
    if (local.length) out.push({ label: 'Pages and actions', rows: local });
    // Results for an older query stay up while the new one loads, rather
    // than the list blinking empty between keystrokes.
    const shown = query.length >= 2 ? (hits ?? []) : [];
    for (const kind of KIND_ORDER) {
      const rows = shown.filter((h) => h.kind === kind).map((h) => toRow(h));
      if (rows.length) out.push({ label: KIND[kind].label, rows });
    }
    return out;
  }, [query, words, hits, recent, toggleTheme]);

  const flat = useMemo(() => groups.flatMap((g) => g.rows), [groups]);

  useEffect(() => setActive(0), [query, hitsFor]);

  // Keep the highlighted row in view as the arrows move it.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const openRow = (row: Row, newTab = false) => {
    if (row.hit) saveRecent(row.hit);
    if (row.action) {
      row.action();
      onClose();
      return;
    }
    if (!row.href) return;
    if (newTab) {
      window.open(row.href, '_blank', 'noopener');
      return;
    }
    onClose();
    router.push(row.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (q) setQ('');
      else onClose();
    } else if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      if (flat.length) setActive((i) => (i + 1) % flat.length);
    } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault();
      if (flat.length) setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = flat[active];
      if (row) openRow(row, e.metaKey || e.ctrlKey);
    }
  };

  const searching = query.length >= 2;
  const noResults = searching && !loading && !failed && hitsFor === query && flat.length === 0;
  const stale = searching && loading && hits !== null;
  let index = -1;

  return (
    <div onKeyDown={onKeyDown}>
      <div className="cp-field">
        <span className="cp-field-icon" aria-hidden>
          {loading ? <span className="cp-spinner" /> : <HugeiconsIcon icon={Search01Icon} size={20} strokeWidth={1.8} />}
        </span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="cp-input"
          placeholder={`Search topics, drafts, posts, or jump to a page${'…'}`}
          role="combobox"
          aria-expanded="true"
          aria-controls="cp-list"
          aria-activedescendant={flat[active] ? `cp-opt-${active}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={80}
        />
        {q && (
          <button
            type="button"
            className="cp-clear"
            onClick={() => {
              setQ('');
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
          </button>
        )}
        <button type="button" className="cp-esc" onClick={onClose} aria-label="Close search">
          esc
        </button>
      </div>

      <div ref={listRef} id="cp-list" role="listbox" aria-label="Results" className={`cp-list scroll-slim ${stale ? 'is-stale' : ''}`}>
        {groups.map((g) => (
          <div key={g.label} role="group" aria-label={g.label} className="cp-group">
            <p className="cp-group-label" aria-hidden>
              {g.label}
            </p>
            {g.rows.map((row) => {
              index += 1;
              const i = index;
              const on = i === active;
              return (
                <div
                  key={row.key}
                  id={`cp-opt-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={on}
                  className={`cp-row ${on ? 'is-active' : ''}`}
                  onPointerMove={() => !on && setActive(i)}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={(e) => openRow(row, e.metaKey || e.ctrlKey)}
                >
                  <span className="cp-row-icon" aria-hidden>
                    <HugeiconsIcon icon={row.icon} size={18} strokeWidth={1.7} />
                  </span>
                  <span className="cp-row-main">
                    <span className="cp-row-title">
                      <Highlight text={row.title} words={words} />
                    </span>
                    {(row.snippet || row.context) && (
                      <span className="cp-row-sub">
                        {row.snippet ? <Highlight text={row.snippet} words={words} /> : row.context}
                      </span>
                    )}
                  </span>
                  {row.snippet && row.context && <span className="cp-row-context">{row.context}</span>}
                  {row.status && <span className={`cp-status is-${row.status}`}>{row.status}</span>}
                  <span className="cp-row-enter" aria-hidden>
                    <HugeiconsIcon icon={CornerDownLeftIcon} size={15} strokeWidth={1.8} />
                  </span>
                </div>
              );
            })}
          </div>
        ))}

        {searching && loading && hits === null && (
          <div className="cp-skeleton" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} />
            ))}
          </div>
        )}
        {query.length === 1 && flat.length === 0 && <p className="cp-empty">Keep typing to search your work.</p>}
        {noResults && (
          <div className="cp-empty">
            <HugeiconsIcon icon={SearchRemoveIcon} size={26} strokeWidth={1.5} />
            <p>
              No results for <strong>{'“'}{query}{'”'}</strong>
            </p>
            <p className="cp-empty-hint">Try fewer words, or part of a word.</p>
          </div>
        )}
        {failed && <p className="cp-empty">Search is unavailable right now. Try again in a moment.</p>}
      </div>

      <div className="cp-foot" aria-hidden>
        <span>
          <kbd>
            <HugeiconsIcon icon={ArrowUp01Icon} size={12} strokeWidth={2.2} />
          </kbd>
          <kbd>
            <HugeiconsIcon icon={ArrowDown01Icon} size={12} strokeWidth={2.2} />
          </kbd>
          to move
        </span>
        <span>
          <kbd>
            <HugeiconsIcon icon={CornerDownLeftIcon} size={12} strokeWidth={2.2} />
          </kbd>
          to open
        </span>
        <span className="cp-foot-wide">
          <kbd>Ctrl</kbd>
          <kbd>
            <HugeiconsIcon icon={CornerDownLeftIcon} size={12} strokeWidth={2.2} />
          </kbd>
          new tab
        </span>
        <span className="ml-auto">
          <kbd>esc</kbd>
          to close
        </span>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {searching && !loading ? `${flat.length} results` : ''}
      </p>
    </div>
  );
}
