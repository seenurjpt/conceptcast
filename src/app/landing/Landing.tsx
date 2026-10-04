import Link from 'next/link';
import { LogoMark } from '@/components/Logo';
import { SITE_AUTHOR } from '@/lib/site';
import { Dock } from './Dock';
import { FAQ } from './faq';
import { FaqItem } from './FaqItem';
import { Hero } from './Hero';
import { Features } from './Features';
import { HowItWorks } from './HowItWorks';
import { LoopVideo } from './LoopVideo';

/**
 * The public front page. Signed-in visitors never see it (src/app/page.tsx
 * sends them to Topics), so it only has to do one job: explain the app to a
 * stranger and get them to the sign-in button.
 *
 * Copy rule from the login screen carries over: each point is one claim with a
 * verb, no feature lists that need a glossary.
 *
 * Built to stay cheap on low-end phones: static HTML, no blur filters (the
 * glows are plain gradients), the video loads only near the viewport, and
 * below-the-fold sections use content-visibility so the browser skips their
 * layout and paint until they scroll close.
 */

export function Landing() {
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

      {/* ── hero ────────────────────────────────────────────────────────── */}
      <Hero />

      {/* ── walkthrough video ─────────────────────────────────────────────────── */}
      <section aria-labelledby="walkthrough-title" className="cv-auto border-b border-hairline bg-surface-soft">
        <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="label">See it run</p>
            <h2 id="walkthrough-title" className="mt-2 text-[clamp(26px,3.4vw,38px)] leading-tight tracking-[-0.8px]">
              From a topic name to a reviewed draft
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-body">
              A real run: adding a topic, getting subtopics suggested, generating a post with web research, and reading
              the draft with its sources and critique.
            </p>
          </div>
          <figure className="mx-auto mt-8 max-w-[960px]">
            <div className="overflow-hidden rounded-[16px] border border-hairline bg-black shadow-[0_24px_80px_-32px_rgba(0,0,0,0.5)] sm:rounded-[24px]">
              {/* A silent loop, like a screenshot that moves: no controls, no
                  pointer events, so it cannot be paused or scrubbed by accident. */}
              <LoopVideo
                src="/showcase-conceptcast.mp4"
                poster="/showcase-poster.jpg"
                posterWebp="/showcase-poster.webp"
                label="conceptcast in use: adding a topic, generating a researched post, and reviewing the draft"
              />
            </div>
          </figure>
        </div>
      </section>

      {/* ── how it works ───────────────────────────────────────────────── */}
      <HowItWorks />

      {/* ── why ────────────────────────────────────────────────────────── */}
      <Features />

      {/* ── keys ───────────────────────────────────────────────────────── */}
      <section id="keys" aria-label="Pricing and AI keys" className="cv-auto scroll-mt-24 border-b border-hairline">
        <div className="mx-auto grid max-w-[1120px] gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div className="max-w-xl">
            <p className="label">Your AI key</p>
            <h2 className="mt-2 text-[clamp(26px,3.4vw,38px)] leading-tight tracking-[-0.8px]">
              It runs on your key, so it costs you what the model costs
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-body">
              Add an Anthropic, OpenAI or Google Gemini key under Settings. Whichever you add gets used; add more than
              one and the app falls through to the next if one fails. Keys are verified when saved and encrypted at
              rest.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-body">
              No key? Google gives a free Gemini key with no card. Settings walks you through it in four steps.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              ['Anthropic', 'Claude Sonnet for research and writing, Haiku for the cheap stages.'],
              ['OpenAI', 'GPT-4o with hosted web search for research.'],
              ['Google Gemini', 'Gemini 2.5 with Google Search grounding. Free tier available.'],
            ].map(([name, body]) => (
              <li key={name} className="card-flush flex items-start gap-3 px-4 py-3.5">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold">{name}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-body">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── faq ────────────────────────────────────────────────────────── */}
      <section id="faq" aria-labelledby="faq-title" className="cv-auto scroll-mt-24 border-b border-hairline bg-surface-soft">
        <div className="mx-auto max-w-[820px] px-4 py-14 sm:px-6 sm:py-20">
          <p className="label">Questions</p>
          <h2 id="faq-title" className="mt-2 text-[clamp(26px,3.4vw,38px)] leading-tight tracking-[-0.8px]">
            Frequently asked questions
          </h2>
          <div className="mt-8 divide-y divide-hairline border-y border-hairline">
            {FAQ.map(({ q, a }) => (
              <FaqItem key={q} q={q} a={a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── final cta ──────────────────────────────────────────────────── */}
      <section aria-labelledby="cta-title" className="cv-auto lp-hero">
        <div className="mx-auto max-w-[1120px] px-4 py-16 text-center sm:px-6 sm:py-24">
          <h2 id="cta-title" className="mx-auto max-w-2xl text-[clamp(28px,4vw,44px)] leading-tight tracking-[-1px]">
            Post one well-researched explainer a week, without spending your week on it.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-[color:var(--lp-ink-2)]">
            Sign in with the LinkedIn account it will post as. It asks for permission to post to your feed and read
            your name and photo, and nothing else.
          </p>
          <Link href="/login" className="btn btn-primary mt-8 h-11 px-7 text-[15px]">
            Continue with LinkedIn
          </Link>
        </div>
      </section>
      </main>

      <footer className="lp-band border-t border-[color:var(--lp-line)]">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-[12px] text-[color:var(--lp-ink-3)] sm:px-6">
          <span className="flex items-center gap-2">
            <LogoMark className="h-4 w-4 text-primary" />
            conceptcast
          </span>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-1">
            <a href="#how" className="hover:text-[color:var(--lp-ink)]">
              How it works
            </a>
            <a href="#keys" className="hover:text-[color:var(--lp-ink)]">
              Pricing
            </a>
            <a href="#faq" className="hover:text-[color:var(--lp-ink)]">
              FAQ
            </a>
            <Link href="/login" className="hover:text-[color:var(--lp-ink)]">
              Sign in
            </Link>
          </nav>
          <p className="flex w-full items-center gap-1.5 sm:w-auto">
            Built by
            <a
              href={SITE_AUTHOR.url}
              target="_blank"
              rel="noopener noreferrer me author"
              className="inline-flex items-center gap-1.5 font-semibold text-[color:var(--lp-ink-2)] hover:text-[color:var(--lp-ink)]"
            >
              <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
              </svg>
              {SITE_AUTHOR.name}
              <span className="sr-only">(GitHub, opens in a new tab)</span>
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
