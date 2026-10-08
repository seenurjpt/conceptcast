import Link from 'next/link';
import { Dock } from './Dock';
import { FAQ } from './faq';
import { FaqItem } from './FaqItem';
import { Hero } from './Hero';
import { Features } from './Features';
import { HowItWorks } from './HowItWorks';
import { LoopVideo } from './LoopVideo';
import { SiteFooter } from './SiteFooter';

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

      <SiteFooter />
    </div>
  );
}
