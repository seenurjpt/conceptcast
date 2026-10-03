import Link from 'next/link';
import { LogoMark } from '@/components/Logo';
import { PipelineDiagram } from '../login/PipelineDiagram';
import { Dock } from './Dock';
import { FAQ } from './faq';
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

const STEPS: [string, string, string][] = [
  ['01', 'Name what you are learning', 'System design, Postgres internals, Kubernetes, or anything else. It suggests about ten subtopics, or you add your own.'],
  ['02', 'Pick a subtopic, click Write a post', 'It researches that one idea on the web against primary sources. Every fact carries a URL; shaky ones are dropped.'],
  ['03', 'It drafts and critiques itself', 'Three angles, scored against a depth rubric. Weak drafts get killed, not shipped. One revision pass if needed.'],
  ['04', 'You decide what goes out', 'The draft waits with its sources one click away. Publish to LinkedIn, edit it, or bin it.'],
];

const FEATURES: [string, string][] = [
  ['Mechanisms, not news', 'Posts explain how something works and why it matters, so they are still correct in a year. News decays in a day.'],
  ['Research first', 'Nothing is written from memory. The researcher reads papers, docs and code, then hands the writer sourced facts only.'],
  ['Your voice', 'Paste a handful of your own posts once. The writer copies the shape and rhythm, never the content.'],
  ['A critic that says no', 'Every draft is scored on depth, surprise and applicability. Anything that would embarrass you never reaches your queue.'],
  ['Your key, your cost', 'Bring an Anthropic, OpenAI or Gemini key. Gemini has a free tier, so the whole loop can cost nothing.'],
  ['You approve every post', 'Nothing runs on a schedule and nothing is published without your click. The app drafts; you decide.'],
];

const STATS: [string, string][] = [
  ['10', 'subtopics suggested per topic'],
  ['~3 min', 'from click to draft'],
  ['$0', 'with a free Gemini key'],
];

export function Landing() {
  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-[100px] focus:bg-primary focus:px-4 focus:py-2 focus:text-[14px] focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <Dock />

      <main id="main">

      {/* ── hero ────────────────────────────────────────────────────────── */}
      <section aria-labelledby="hero-title" className="lp-hero relative overflow-hidden">

        <div className="relative mx-auto max-w-[1120px] px-4 pb-14 pt-28 sm:px-6 sm:pt-36 lg:pb-20">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="min-w-0">
              <span className="inline-flex w-fit items-center rounded-[100px] border border-[color:var(--lp-line-2)] px-3 py-1 text-[12px] font-semibold text-[color:var(--lp-ink-2)]">
                For your personal LinkedIn
              </span>
              <h1 id="hero-title" className="mt-5 text-[clamp(36px,5.2vw,64px)] leading-[1.02] tracking-[-1.6px]">
                Post what you are learning.
                <br />
                <span className="text-[color:var(--lp-ink-soft)]">Researched, not recalled.</span>
              </h1>
              <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-[color:var(--lp-ink-2)] sm:text-[17px]">
                Name a topic. conceptcast breaks it into subtopics, researches each one on the web against primary
                sources, drafts a technical explainer in your voice, critiques it, and waits for your approval before
                anything reaches your feed.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/login" className="btn btn-primary h-11 px-6 text-[15px]">
                  Continue with LinkedIn
                </Link>
                <a
                  href="#how"
                  className="btn h-11 border-[color:var(--lp-line-2)] bg-[var(--lp-chip)] px-6 text-[15px] text-[color:var(--lp-ink)] hover:bg-[var(--lp-chip-hover)]"
                >
                  How it works
                </a>
              </div>
              <p className="mt-3 text-[12px] text-[color:var(--lp-ink-3)]">
                Bring your own AI key. Nothing is posted without your click.
              </p>
            </div>

            <div className="lp-island min-w-0 rounded-[24px] border p-5 sm:p-6">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-white/55">The pipeline</p>
              <div className="mt-4">
                <PipelineDiagram />
              </div>
            </div>
          </div>

          <dl className="mt-12 grid max-w-2xl grid-cols-3 gap-6 border-t border-[color:var(--lp-line)] pt-6">
            {STATS.map(([value, label]) => (
              <div key={label}>
                <dt className="font-mono text-[22px] font-medium tabular-nums">{value}</dt>
                <dd className="mt-0.5 text-[12px] leading-snug text-[color:var(--lp-ink-3)]">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

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
      <section id="how" aria-labelledby="how-title" className="cv-auto scroll-mt-24 border-b border-hairline">
        <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <p className="label">How it works</p>
            <h2 id="how-title" className="mt-2 text-[clamp(26px,3.4vw,38px)] leading-tight tracking-[-0.8px]">
              Four steps, and you are at both ends
            </h2>
          </div>
          <ol className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {STEPS.map(([n, title, body]) => (
              <li key={n} className="flex gap-4">
                <span className="t-number shrink-0 pt-1 text-[13px] text-muted">{n}</span>
                <div className="min-w-0">
                  <h3 className="text-[17px] font-semibold leading-snug">{title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-body">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── why ────────────────────────────────────────────────────────── */}
      <section aria-label="What makes it different" className="cv-auto border-b border-hairline bg-surface-soft">
        <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <p className="label">What makes it different</p>
            <h2 className="mt-2 text-[clamp(26px,3.4vw,38px)] leading-tight tracking-[-0.8px]">
              Built to be wrong less often than you are
            </h2>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([title, body]) => (
              <li key={title} className="card">
                <h3 className="text-[16px] font-semibold leading-snug">{title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-body">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

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
              <details key={q} className="faq py-1">
                <summary className="flex cursor-pointer items-center justify-between gap-4 py-4">
                  <h3 className="text-[16px] font-semibold leading-snug">{q}</h3>
                  <span aria-hidden className="faq-icon shrink-0 text-[20px] leading-none text-muted">
                    +
                  </span>
                </summary>
                <p className="pb-5 pr-8 text-[15px] leading-relaxed text-body">{a}</p>
              </details>
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
        </div>
      </footer>
    </div>
  );
}
