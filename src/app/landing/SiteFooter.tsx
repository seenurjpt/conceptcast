import Link from 'next/link';
import { LogoMark } from '@/components/Logo';
import { SITE_AUTHOR } from '@/lib/site';

/**
 * The public pages' footer (landing, About, Privacy). Section links point at
 * the landing page by path, so they work from every page; on the landing
 * page itself they just scroll.
 */
export function SiteFooter() {
  const link = 'hover:text-[color:var(--lp-ink)]';
  return (
    <footer className="lp-band border-t border-[color:var(--lp-line)]">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-[12px] text-[color:var(--lp-ink-3)] sm:px-6">
        <Link href="/" className="flex items-center gap-2 hover:text-[color:var(--lp-ink)]">
          <LogoMark className="h-4 w-4 text-primary" />
          conceptcast
        </Link>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/#how" className={link}>
            How it works
          </Link>
          <Link href="/#keys" className={link}>
            Pricing
          </Link>
          <Link href="/#faq" className={link}>
            FAQ
          </Link>
          <Link href="/about" className={link}>
            About
          </Link>
          <Link href="/privacy" className={link}>
            Privacy
          </Link>
          <Link href="/login" className={link}>
            Sign in
          </Link>
        </nav>
        <p className="flex w-full items-center gap-1.5 sm:w-auto">
          Built by
          <a
            href={SITE_AUTHOR.linkedin}
            target="_blank"
            rel="noopener noreferrer me author"
            className="font-semibold text-[color:var(--lp-ink-2)] hover:text-[color:var(--lp-ink)]"
          >
            {SITE_AUTHOR.name}
            <span className="sr-only"> (LinkedIn, opens in a new tab)</span>
          </a>
          <span className="ml-1 flex items-center gap-0.5">
            <a
              href={SITE_AUTHOR.linkedin}
              target="_blank"
              rel="noopener noreferrer me"
              className="footer-social"
              aria-label={`${SITE_AUTHOR.name} on LinkedIn (opens in a new tab)`}
              title="LinkedIn"
            >
              <LinkedInMark />
            </a>
            <a
              href={SITE_AUTHOR.url}
              target="_blank"
              rel="noopener noreferrer me"
              className="footer-social"
              aria-label={`${SITE_AUTHOR.name} on GitHub (opens in a new tab)`}
              title="GitHub"
            >
              <GitHubMark />
            </a>
          </span>
        </p>
      </div>
    </footer>
  );
}

/** LinkedIn's "in" mark, in the current text colour. */
export function LinkedInMark({ size = 14 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M0 1.15C0 .52.52 0 1.17 0h13.66C15.48 0 16 .52 16 1.15v13.7c0 .63-.52 1.15-1.17 1.15H1.17C.52 16 0 15.48 0 14.85zm4.94 12.24V6.17H2.54v7.22zM3.74 5.18c.84 0 1.36-.55 1.36-1.25-.02-.71-.52-1.25-1.34-1.25S2.4 3.22 2.4 3.93c0 .7.52 1.25 1.33 1.25zm4.91 8.21V9.36c0-.22.02-.43.08-.59.17-.43.57-.88 1.23-.88.87 0 1.21.66 1.21 1.63v3.87h2.4V9.25c0-2.22-1.18-3.25-2.76-3.25-1.27 0-1.84.7-2.16 1.19v.03h-.02l.02-.03V6.17h-2.4c.03.68 0 7.22 0 7.22z" />
    </svg>
  );
}

export function GitHubMark({ size = 14 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
