'use client';

import { useEffect, useState } from 'react';
import { useDialog, type ConfirmOptions } from './Modal';

/* ── page scaffolding ─────────────────────────────────────────────────────── */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="t-display">{title}</h1>
        {subtitle && <p className="t-body-sm mt-1 max-w-3xl text-body">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  className = '',
  flush = false,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={`${flush ? 'card-flush' : 'card'} ${className}`}>
      {title && (
        <header className={`flex items-center justify-between gap-2 ${flush ? 'border-b border-hairline px-5 py-3' : 'mb-3'}`}>
          <span className="label mb-0">{title}</span>
          {action}
        </header>
      )}
      {flush ? <div className="px-5 py-4">{children}</div> : children}
    </section>
  );
}

/* ── feedback ─────────────────────────────────────────────────────────────── */

export function Notice({
  kind,
  children,
  onDismiss,
}: {
  kind: 'error' | 'ok' | 'attention';
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div className={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span className="min-w-0 flex-1">{children}</span>
      {onDismiss && (
        <button className="btn-text shrink-0 text-inherit opacity-60" onClick={onDismiss} aria-label="Dismiss">
          ✕
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card mx-auto flex max-w-xl flex-col items-center gap-2 py-14 text-center">
      <p className="t-title-sm">{title}</p>
      {children && <div className="t-body-sm text-balance text-body">{children}</div>}
    </div>
  );
}

/* ── data display ─────────────────────────────────────────────────────────── */

export function TrackBadge({ track }: { track: string | null | undefined }) {
  if (!track) return null;
  return <span className={`badge badge-track track-${track}`}>{track}</span>;
}

/** The colour dot alone, for dense rows where the full badge is too much. */
export function TrackDot({ track }: { track: string | null | undefined }) {
  if (!track) return null;
  return (
    <span
      className={`track-${track} inline-block h-2 w-2 shrink-0 rounded-full`}
      style={{ background: 'var(--track)' }}
      title={track}
    />
  );
}

/** Critic score, coloured by the passing line (7). */
export function ScoreBadge({ score, passed }: { score: number; passed?: boolean }) {
  const tone = passed === false ? 'badge-down' : score >= 8 ? 'badge-up' : score >= 7 ? 'badge-primary' : 'badge-attention';
  return (
    <span className={`badge ${tone}`}>
      <span className="t-number text-[12px]">{score}</span>
      <span className="opacity-60">/10</span>
    </span>
  );
}

/** A labelled number, mono-faced per the design system. */
export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'up' | 'down' }) {
  return (
    <div>
      <div className="label mb-0.5">{label}</div>
      <div className={`t-number ${tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : ''}`}>{value}</div>
    </div>
  );
}

/* ── interaction ──────────────────────────────────────────────────────────── */

/** A button that shows its own pending state and never double-fires. */
export function ActionButton({
  onClick,
  children,
  pendingLabel,
  className = 'btn',
  disabled,
  title,
  confirm,
}: {
  onClick: () => Promise<unknown> | unknown;
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
  title?: string;
  /** Shows a confirmation dialog first. A bare string becomes the title. */
  confirm?: string | ConfirmOptions;
}) {
  const dialog = useDialog();
  const [pending, setPending] = useState(false);
  useEffect(() => () => setPending(false), []);
  return (
    <button
      className={className}
      disabled={disabled || pending}
      title={title}
      onClick={async () => {
        if (confirm) {
          const opts = typeof confirm === 'string' ? { title: confirm } : confirm;
          if (!(await dialog.confirm(opts))) return;
        }
        setPending(true);
        try {
          await onClick();
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? (pendingLabel ?? 'Working…') : children}
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-[100px] bg-surface-strong p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-[100px] px-3 py-1.5 text-[13px] font-semibold transition-colors ${
            value === o.value ? 'bg-canvas text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1.5 opacity-50">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Progress meter for the character budget. */
export function CharMeter({ count, min, max }: { count: number; min: number; max: number }) {
  const over = count > max;
  const under = count < min;
  const pct = Math.min(100, (count / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-24 overflow-hidden rounded-[100px] bg-surface-strong">
        <div
          className={`h-full rounded-[100px] transition-all ${over || under ? 'bg-attention' : 'bg-up'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`t-number text-[13px] ${over || under ? 'text-attention' : 'text-muted'}`}>
        {count}
      </span>
      <span className="t-caption text-muted-soft">/ {max}</span>
    </div>
  );
}
