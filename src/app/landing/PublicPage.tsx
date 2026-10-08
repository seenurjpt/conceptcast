import { Dock } from './Dock';
import { SiteFooter } from './SiteFooter';

/**
 * The frame for public pages other than the landing page (About, Privacy):
 * the same floating dock, a header band in the landing palette, and the
 * same footer, so they read as part of the one site.
 */
export function PublicPage({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="lp-page min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-[100px] focus:bg-primary focus:px-4 focus:py-2 focus:text-[14px] focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <Dock />
      <main id="main">
        <header className="lp-hero border-b border-[color:var(--lp-line)]">
          <div className="mx-auto max-w-[1120px] px-4 pb-12 pt-32 sm:px-6 sm:pb-16 sm:pt-40">
            <p className="label">{eyebrow}</p>
            <h1 className="mt-2 max-w-3xl text-[clamp(32px,5vw,52px)] font-semibold leading-[1.08] tracking-[-0.03em]">{title}</h1>
            {lede && <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[color:var(--lp-ink-2)]">{lede}</p>}
          </div>
        </header>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
