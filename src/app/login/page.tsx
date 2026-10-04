import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoMark } from '@/components/Logo';
import { ThemeSwitch } from '../landing/Dock';
import { LoginPanel } from './LoginPanel';
import { PipelineDiagram } from './PipelineDiagram';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to conceptcast with the LinkedIn account it will post as.',
  // The landing page is the canonical public page; this one is a door.
  robots: { index: false, follow: true },
};

export const dynamic = 'force-dynamic';

/**
 * Fits one viewport at every size, so nothing scrolls. That is a content
 * constraint before it is a CSS one: each point is one line, and the copy is
 * cut rather than the type shrunk past readability.
 *
 * The left panel matches the landing hero: pure black, the app's blue light,
 * the same headline with its blue second line. It stays dark in both themes,
 * as the hero does. The right panel follows the theme, which the switch in
 * its corner changes (shared with the landing page and the dashboard).
 */
const STEPS = [
  ['01', 'Name what you are learning', 'System design, Postgres internals, Kubernetes, or anything else. It suggests ten subtopics; pick one and hit generate.'],
  ['02', 'It researches the sources', 'Papers, docs and source code. Every fact carries a URL; shaky ones are dropped.'],
  ['03', 'It drafts and critiques itself', 'Three angles, scored against a depth rubric. Weak drafts get killed, not shipped.'],
  ['04', 'You decide what goes out', 'The draft waits with its sources one click away. Publish it, edit it, or bin it.'],
];

const STATS = [
  ['10', 'subtopics suggested'],
  ['~3 min', 'from click to draft'],
  ['$0', 'with a free Gemini key'],
];

function HomeLogo({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="conceptcast home"
      className={`group flex w-fit items-center gap-2.5 rounded-[100px] transition-opacity hover:opacity-80 ${className}`}
    >
      <LogoMark className="h-6 w-6 text-primary" />
      <span className="text-[16px] font-semibold tracking-[-0.02em]">conceptcast</span>
    </Link>
  );
}

export default function LoginPage() {
  return (
    // h-dvh, not h-screen: dvh accounts for mobile browser chrome, which is the
    // usual reason a "100vh" page still scrolls on a phone.
    <div className="lp-page flex min-h-dvh flex-col lg:grid lg:h-dvh lg:grid-cols-[1.05fr_minmax(400px,0.9fr)] lg:overflow-hidden">
      {/* Left: what this is. Hidden on small screens: on a phone the door matters
          more than the pitch, and keeping both would force a scroll. */}
      <section className="login-hero relative isolate hidden min-w-0 flex-col justify-between overflow-hidden px-10 py-10 lg:flex xl:px-14">
        <div aria-hidden className="lp-stars" />

        <header className="relative shrink-0">
          <HomeLogo className="text-white" />
        </header>

        <div className="relative flex min-w-0 max-w-xl flex-1 flex-col justify-center py-8">
          <span className="inline-flex w-fit items-center rounded-[100px] border border-white/15 bg-white/[0.04] px-3 py-1 text-[12px] font-semibold text-white/75">
            For your personal LinkedIn
          </span>

          <h1 className="mt-5 text-[clamp(34px,3.4vw,52px)] font-semibold leading-[1.05] tracking-[-0.035em] text-white">
            Post what you are learning.
            <br />
            <span className="text-[#4d8bff]">Researched, not recalled.</span>
          </h1>

          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-[#a8acb3]">
            Name a topic, pick a subtopic, and conceptcast researches it on the web against primary sources, then
            drafts an explainer in your voice that is still correct in a year. You approve every post.
          </p>

          <div className="mt-7">
            <PipelineDiagram />
          </div>
        </div>

        <dl className="relative grid max-w-xl shrink-0 grid-cols-3 gap-6 border-t border-white/10 pt-5">
          {STATS.map(([value, label]) => (
            <div key={label}>
              <dt className="font-mono text-[19px] font-medium tabular-nums text-white">{value}</dt>
              <dd className="mt-0.5 text-[12px] text-[#868c94]">{label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Right: the actual door. Scrolls internally only if a very short viewport
          leaves no other option, so the page itself never does. */}
      <section className="scroll-slim relative flex min-h-0 flex-1 flex-col justify-center overflow-y-auto border-hairline bg-canvas px-6 py-10 sm:px-10 lg:border-l lg:px-10 lg:py-12 xl:px-12">
        <ThemeSwitch className="absolute right-4 top-4 sm:right-6 sm:top-6" />

        <div className="mx-auto w-full max-w-md">
          {/* The brand only appears here when the left panel is hidden. */}
          <HomeLogo className="mb-6 sm:mb-8 lg:hidden" />

          <LoginPanel />

          <ol className="mt-6 space-y-3.5 border-t border-hairline pt-5 sm:mt-8 sm:space-y-4 sm:pt-6">
            {STEPS.map(([n, title, body]) => (
              <li key={n} className="flex gap-3.5">
                <span className="t-number shrink-0 pt-px text-[12px] text-muted">{n}</span>
                <div className="min-w-0">
                  <h2 className="text-[14px] font-semibold leading-snug">{title}</h2>
                  <p className="mt-0.5 text-[13px] leading-snug text-body">{body}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* Desktop only: it balances the taller left column. On a short phone
              the same paragraph is what pushes the page into a scroll. */}
          <p className="mt-6 hidden border-t border-hairline pt-4 text-[12px] leading-snug text-muted lg:block">
            Nothing runs on its own. You pick the topic and you approve the post.
          </p>
        </div>
      </section>
    </div>
  );
}
