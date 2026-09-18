'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

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

  // The page behind must not scroll while a dialog is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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
