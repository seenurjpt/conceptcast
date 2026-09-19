'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useSession } from './SessionProvider';
import { LogoMark } from './Logo';
import { useDialog } from './Modal';
import { fmtDay } from '@/lib/ui';

/** Ordered by the actual flow: pick a topic, review the draft, see what shipped. */
const LINKS = [
  { href: '/backlog', label: 'Topics' },
  { href: '/review', label: 'Drafts' },
  { href: '/calendar', label: 'Published' },
  { href: '/voice', label: 'Voice' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/admin/exemplars', label: 'Exemplars' },
];

export function Nav() {
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close on navigation: without this the drawer stays open over the new page.
  useEffect(() => setMenuOpen(false), [path]);

  return (
    <>
      {/* Outside the sticky header on purpose: a fixed child of a sticky
          ancestor is positioned against that ancestor, not the viewport, so
          the drawer collapsed to the header's own height. */}
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} path={path} />

    <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-4 sm:px-5 md:gap-6">
        <button
          className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink md:hidden"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <Link href="/backlog" className="flex shrink-0 items-center gap-2" aria-label="conceptcast home">
          <LogoMark className="h-6 w-6 text-primary" />
          <span className="t-title-sm tracking-[-0.02em]">conceptcast</span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = path === l.href || path.startsWith(l.href + '/');
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-[100px] px-3 py-1.5 text-[14px] font-medium transition-colors ${
                  active ? 'bg-surface-strong text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>

    </header>
    </>
  );
}

function MobileMenu({ open, onClose, path }: { open: boolean; onClose: () => void; path: string }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // The page behind must not scroll while the drawer is over it.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('a')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    // z-40 clears the sticky header's z-30 so the drawer covers it.
    <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        id="mobile-menu"
        className="absolute inset-y-0 left-0 flex w-[min(17rem,82vw)] flex-col border-r border-hairline bg-surface-card shadow-[0_0_40px_rgba(0,0,0,0.35)]"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-hairline px-4">
          <span className="flex items-center gap-2">
            <LogoMark className="h-6 w-6 text-primary" />
            <span className="t-title-sm tracking-[-0.02em]">conceptcast</span>
          </span>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink"
            onClick={onClose}
            aria-label="Close menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="scroll-slim flex-1 overflow-y-auto p-2">
          {LINKS.map((l) => {
            const active = path === l.href || path.startsWith(l.href + '/');
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center rounded-[12px] px-3 py-3 text-[15px] font-medium transition-colors ${
                  active ? 'bg-surface-strong text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const isDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(isDark);
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }, []);

  if (dark === null) return <span className="h-9 w-9" />;
  return (
    <button
      className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.dataset.theme = next ? 'dark' : 'light';
        localStorage.setItem('theme', next ? 'dark' : 'light');
      }}
    >
      {dark ? '☾' : '☀'}
    </button>
  );
}

function AccountMenu() {
  const { session, loading, signOut, signInHref } = useSession();
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const [pictureFailed, setPictureFailed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (loading) return <span className="avatar h-9 w-9 animate-pulse" />;

  if (!session?.member) {
    if (!session?.configured) {
      return <span className="badge badge-quiet hidden sm:inline-flex">LinkedIn not configured</span>;
    }
    return (
      <a className="btn btn-primary btn-sm" href={signInHref()}>
        Sign in with LinkedIn
      </a>
    );
  }

  const { member, state } = session;
  const initials = (member.name ?? 'You')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const needsAttention = state !== 'ok';

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-center gap-2 rounded-[100px] p-1 pr-2 transition-colors hover:bg-surface-strong"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="relative">
          {member.picture && !pictureFailed ? (
            <Image
              src={member.picture}
              alt=""
              width={32}
              height={32}
              className="avatar h-8 w-8 object-cover"
              // LinkedIn CDN URLs are time-limited; fall back to initials
              // rather than leaving an empty circle when one expires.
              onError={() => setPictureFailed(true)}
              unoptimized
            />
          ) : (
            <span className="avatar h-8 w-8">{initials}</span>
          )}
          {needsAttention && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-canvas bg-attention" />
          )}
        </span>
        <span className="hidden max-w-[120px] truncate text-[14px] font-medium sm:block">
          {member.name ?? 'Signed in'}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] w-72 overflow-hidden rounded-[16px] border border-hairline bg-surface-card shadow-[0_4px_12px_rgba(0,0,0,0.04)]"
        >
          <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
            {member.picture && !pictureFailed ? (
              <Image
                src={member.picture}
                alt=""
                width={40}
                height={40}
                className="avatar h-10 w-10 shrink-0 object-cover"
                onError={() => setPictureFailed(true)}
                unoptimized
              />
            ) : (
              <span className="avatar h-10 w-10 shrink-0 text-[14px]">{initials}</span>
            )}
            <div className="min-w-0">
              <p className="t-title-sm truncate">{member.name ?? 'LinkedIn member'}</p>
              <p className="t-caption truncate text-muted">{member.email ?? member.urn}</p>
            </div>
          </div>

          <div className="space-y-1.5 border-b border-hairline px-4 py-3 text-[13px]">
            <Row label="Publishing">
              {state === 'ok' && <span className="text-up">Active</span>}
              {state === 'refresh-due' && <span className="text-attention">Renewing soon</span>}
              {(state === 'expired' || state === 'refresh-expired') && <span className="text-down">Sign in again</span>}
            </Row>
            {session.expiresAt && <Row label="Token expires">{fmtDay(session.expiresAt)}</Row>}
            <Row label="Metrics">
              {session.canFetchMetrics ? 'Automatic' : <span className="text-muted">Manual entry</span>}
            </Row>
          </div>

          <div className="p-2">
            {needsAttention && (
              <a className="btn btn-primary btn-sm w-full" href={signInHref()}>
                Sign in again
              </a>
            )}
            {session.source !== 'env' && (
              <button
                // .btn-text hard-codes the brand colour, so the danger tone is
                // set inline rather than lost to specificity.
                style={{ color: 'var(--down)' }}
                className="btn btn-text mt-1 w-full justify-start px-2 py-1.5 text-[13px]"
                onClick={async () => {
                  const ok = await dialog.confirm({
                    title: 'Sign out?',
                    body: 'Your drafts and topics stay where they are. You will need to sign in with LinkedIn again before publishing.',
                    confirmLabel: 'Sign out',
                    danger: true,
                  });
                  if (!ok) return;
                  setOpen(false);
                  await signOut();
                  window.location.href = '/login';
                }}
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}
