'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogoMark } from '@/components/Logo';

/**
 * The landing page's navigation as a floating dock: a glass pill that sits
 * over the page instead of a full-width bar. It firms up once the page
 * scrolls, so it stays legible over the sections below the hero.
 */
export function Dock() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 24;
      setScrolled((prev) => (prev === next ? prev : next));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-3 sm:top-5">
      <nav
        aria-label="Main"
        className={`pointer-events-auto flex w-full max-w-[600px] items-center gap-1 rounded-[100px] border p-1.5 text-[color:var(--lp-ink)] backdrop-blur-md transition-[background-color,box-shadow,border-color] duration-300 ${
          scrolled
            ? 'border-[color:var(--lp-dock-line-scrolled)] bg-[var(--lp-dock-scrolled)] shadow-[var(--lp-dock-shadow-scrolled)]'
            : 'border-[color:var(--lp-dock-line)] bg-[var(--lp-dock)] shadow-[var(--lp-dock-shadow)]'
        }`}
      >
        <Link
          href="/"
          className="flex items-center gap-2 rounded-[100px] py-1.5 pl-2.5 pr-3 transition-colors hover:bg-[var(--lp-chip-hover)]"
        >
          <LogoMark className="h-[22px] w-[22px] text-primary" />
          <span className="text-[15px] font-semibold tracking-[-0.02em]">conceptcast</span>
        </Link>

        <span aria-hidden className="mx-1 hidden h-5 w-px bg-[var(--lp-line-2)] sm:block" />

        <a
          href="#how"
          className="hidden rounded-[100px] px-3.5 py-2 text-[13px] font-medium text-[color:var(--lp-ink-2)] transition-colors hover:bg-[var(--lp-chip-hover)] hover:text-[color:var(--lp-ink)] sm:block"
        >
          How it works
        </a>
        <a
          href="#keys"
          className="hidden rounded-[100px] px-3.5 py-2 text-[13px] font-medium text-[color:var(--lp-ink-2)] transition-colors hover:bg-[var(--lp-chip-hover)] hover:text-[color:var(--lp-ink)] md:block"
        >
          Pricing
        </a>

        <ThemeSwitch />
        <Link href="/login" className="btn btn-sm btn-primary h-9 px-4">
          Sign in
        </Link>
      </nav>
    </header>
  );
}

/**
 * Light/dark switch for the public pages (landing dock and sign-in screen).
 * The choice is stored under the same key as the dashboard's toggle, so it
 * carries across the whole app. Reads the theme the head script already
 * applied instead of recomputing it, so the icon always matches the screen.
 */
export function ThemeSwitch({ className = 'ml-auto' }: { className?: string }) {
  const [theme, setTheme] = useState<'dark' | 'light' | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  }, []);

  const dark = theme !== 'light';
  return (
    <button
      type="button"
      onClick={() => {
        const next = dark ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem('theme', next);
        } catch {
          // Private mode or blocked storage: the switch still works for this visit.
        }
        setTheme(next);
      }}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
      className={`${className} flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[color:var(--lp-ink-2)] transition-colors hover:bg-[var(--lp-chip-hover)] hover:text-[color:var(--lp-ink)]`}
    >
      {/* Both icons are in the HTML and CSS shows the one for the current
          theme, so the right icon is there before hydration and without JS. */}
      <SunIcon />
      <MoonIcon />
    </button>
  );
}

function SunIcon() {
  return (
    <svg className="lp-icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="lp-icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
