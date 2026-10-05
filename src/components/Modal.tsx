'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { lockPage } from '@/lib/pageLock';

/**
 * Replaces window.confirm / window.prompt, which ignore the design system and
 * block the main thread. Exposed as promise-returning functions so call sites
 * read the same way the native ones did.
 */

export interface ConfirmOptions {
  title: string;
  /** Supporting detail. Keep it to what changes the decision. */
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button, for destructive or irreversible actions. */
  danger?: boolean;
}

export interface PromptOptions {
  title: string;
  body?: React.ReactNode;
  label: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  /** Reject the empty string; by default an empty answer is allowed. */
  required?: boolean;
  multiline?: boolean;
  /** Red confirm button, when the action behind the prompt is destructive. */
  danger?: boolean;
}

interface DialogApi {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  /** Resolves with the text, or null if dismissed. */
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const Ctx = createContext<DialogApi>({
  confirm: async () => false,
  prompt: async () => null,
});

export function useDialog(): DialogApi {
  return useContext(Ctx);
}

type Pending =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void };

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (opts) => new Promise<boolean>((resolve) => setPending({ kind: 'confirm', opts, resolve })),
      prompt: (opts) => new Promise<string | null>((resolve) => setPending({ kind: 'prompt', opts, resolve })),
    }),
    [],
  );

  const close = useCallback(
    (value: boolean | string | null) => {
      if (!pending) return;
      if (pending.kind === 'confirm') pending.resolve(value === true);
      else pending.resolve(typeof value === 'string' ? value : null);
      setPending(null);
    },
    [pending],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {pending && <Dialog pending={pending} onClose={close} />}
    </Ctx.Provider>
  );
}

function Dialog({ pending, onClose }: { pending: Pending; onClose: (v: boolean | string | null) => void }) {
  const isPrompt = pending.kind === 'prompt';
  const [value, setValue] = useState(isPrompt ? (pending.opts as PromptOptions).initialValue ?? '' : '');
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus the thing the user is most likely to act on.
  useEffect(() => {
    (isPrompt ? firstFieldRef.current : confirmRef.current)?.focus();
  }, [isPrompt]);

  // Escape cancels; Tab stays inside the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose(isPrompt ? null : false);
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, input, textarea, [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isPrompt, onClose]);

  // The page behind must not scroll, and its edge strips dim with it.
  useEffect(() => lockPage(), []);

  const opts = pending.opts;
  const promptOpts = isPrompt ? (opts as PromptOptions) : null;
  const confirmOpts = isPrompt ? null : (opts as ConfirmOptions);
  const blocked = Boolean(promptOpts?.required && value.trim() === '');

  const submit = () => {
    if (isPrompt) {
      if (blocked) return;
      onClose(value);
    } else {
      onClose(true);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={() => onClose(isPrompt ? null : false)}
        aria-hidden
      />
      <div
        ref={panelRef}
        className="relative w-full max-w-md rounded-[20px] border border-hairline bg-surface-card p-5 shadow-[0_16px_48px_rgba(0,0,0,0.28)]"
      >
        <h2 id="dialog-title" className="t-title">
          {opts.title}
        </h2>
        {opts.body && <div className="t-body-sm mt-2 text-body">{opts.body}</div>}

        {promptOpts && (
          <div className="mt-4">
            <label className="label" htmlFor="dialog-field">
              {promptOpts.label}
            </label>
            {promptOpts.multiline ? (
              <textarea
                id="dialog-field"
                ref={firstFieldRef as React.RefObject<HTMLTextAreaElement>}
                className="input min-h-[96px] w-full"
                value={value}
                placeholder={promptOpts.placeholder}
                onChange={(e) => setValue(e.target.value)}
              />
            ) : (
              <input
                id="dialog-field"
                ref={firstFieldRef as React.RefObject<HTMLInputElement>}
                className="input w-full"
                value={value}
                placeholder={promptOpts.placeholder}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-quiet" onClick={() => onClose(isPrompt ? null : false)}>
            {confirmOpts?.cancelLabel ?? 'Cancel'}
          </button>
          <button
            ref={confirmRef}
            className={`btn ${opts.danger ? 'btn-danger-solid' : 'btn-primary'}`}
            disabled={blocked}
            onClick={submit}
          >
            {opts.confirmLabel ?? (isPrompt ? 'Save' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * A modal with arbitrary content (a list, a preview), for when confirm and
 * prompt are not enough. Same behaviour as the dialogs above: Escape and the
 * backdrop close it, Tab stays inside, the page behind is locked, and focus
 * goes back to whatever opened it.
 */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  size = 'md',
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'md' | 'lg';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, input, textarea, select, [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => lockPage(), []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        className={`relative flex max-h-[85dvh] w-full flex-col rounded-t-[24px] border border-hairline bg-surface-card shadow-[0_16px_48px_rgba(0,0,0,0.28)] sm:rounded-[20px] ${
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg'
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <h2 id="modal-title" className="t-title">
              {title}
            </h2>
            {subtitle && <div className="t-body-sm mt-0.5 text-muted">{subtitle}</div>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
