'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Menu01Icon, Moon02Icon, Sun03Icon } from '@hugeicons/core-free-icons';
import { useSession } from './SessionProvider';
import { LogoMark } from './Logo';
import { useDialog } from './Modal';
import { SidebarNav } from './Sidebar';
import { SearchTrigger } from './CommandPalette';
import { fmtDay } from '@/lib/ui';
import { lockPage } from '@/lib/pageLock';

/**
 * The top bar: the theme switch and the account menu. Each page names
 * itself in its own heading, so the bar does not repeat it.
 * Navigation lives in the sidebar; below lg the bar's menu button opens the
 * same nav in a drawer.
 */
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
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/90 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-5 lg:px-8">
          <button
            className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <HugeiconsIcon icon={Menu01Icon} size={22} strokeWidth={1.8} />
          </button>

          <Link href="/dashboard" className="flex shrink-0 items-center gap-2 lg:hidden" aria-label="conceptcast home">
            <LogoMark className="h-6 w-6 text-primary" />
            <span className="t-title-sm hidden tracking-[-0.02em] min-[400px]:inline">conceptcast</span>
          </Link>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            <SearchTrigger />
            <ThemeToggle />
            <AccountMenu />
          </div>
        </div>
      </header>
    </>
  );
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // The page behind must not scroll, and its edge strips dim with it.
    const unlock = lockPage();
    return () => {
      document.removeEventListener('keydown', onKey);
      unlock();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        // z-40 clears the sticky header's z-30 so the drawer covers it.
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
          />
          <motion.div
            ref={panelRef}
            id="mobile-menu"
            className="drawer-panel absolute inset-y-0 left-0 flex w-[min(18rem,84vw)] flex-col border-r border-hairline bg-surface-soft shadow-[0_0_40px_rgba(0,0,0,0.35)]"
            initial={{ x: reduce ? 0 : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: reduce ? 0 : '-100%' }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 40 }}
            onAnimationComplete={() => {
              // Focus once the panel has arrived, so the ring does not ride in.
              if (open) panelRef.current?.querySelector<HTMLElement>('.side-link[aria-current], .side-link')?.focus();
            }}
          >
            <div className="flex h-16 shrink-0 items-center justify-between px-4">
              <span className="flex items-center gap-2 pl-[10px]">
                <LogoMark className="h-6 w-6 text-primary" />
                <span className="t-title-sm tracking-[-0.02em]">conceptcast</span>
              </span>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink"
                onClick={onClose}
                aria-label="Close menu"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={20} strokeWidth={1.8} />
              </button>
            </div>
            <SidebarNav id="drawer" onCompose={onClose} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const isDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(isDark);
    const root = document.documentElement;
    root.dataset.theme = isDark ? 'dark' : 'light';
    // The search palette can switch the theme too; follow it.
    const mo = new MutationObserver(() => setDark(root.dataset.theme === 'dark'));
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);

  if (dark === null) return <span className="h-9 w-9" />;
  return (
    <button
      className="theme-toggle flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.dataset.theme = next ? 'dark' : 'light';
        localStorage.setItem('theme', next ? 'dark' : 'light');
      }}
    >
      <span key={dark ? 'moon' : 'sun'} className="theme-toggle-icon">
        <HugeiconsIcon icon={dark ? Moon02Icon : Sun03Icon} size={19} strokeWidth={1.8} />
      </span>
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
        className="flex items-center rounded-[100px] p-1 transition-colors hover:bg-surface-strong"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        // Just the avatar on the bar; the name is in the menu it opens.
        aria-label={`Account: ${member.name ?? 'signed in'}`}
        title={member.name ?? undefined}
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
