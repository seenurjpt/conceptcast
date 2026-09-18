import type { Metadata } from 'next';
import { LogoMark } from '@/components/Logo';
import { LoginPanel } from './LoginPanel';
import { PipelineDiagram } from './PipelineDiagram';

export const metadata: Metadata = {
  title: 'conceptcast — sign in',
  description: 'Research, draft, review and publish technical explainers to LinkedIn.',
};

export const dynamic = 'force-dynamic';

/**
 * Fits one viewport at every size, so nothing scrolls. That is a content
 * constraint before it is a CSS one: each point is one line, and the copy is
 * cut rather than the type shrunk past readability.
 */
const STEPS = [
  ['01', 'Pick a topic', '63 AI engineering concepts, ordered so each builds on the last. Choose one and hit generate.'],
  ['02', 'It researches the sources', 'Papers, docs and source code. Every fact carries a URL; shaky ones are dropped.'],
  ['03', 'It drafts and critiques itself', 'Three angles, scored against a depth rubric. Weak drafts get killed, not shipped.'],
  ['04', 'You decide what goes out', 'The draft waits with its sources one click away. Publish it, edit it, or bin it.'],
];

const STATS = [
  ['63', 'topics ready'],
  ['3', 'minutes a draft'],
  ['~$0.30', 'per post'],
];

export default function LoginPage() {
  return (
    // h-dvh, not h-screen: dvh accounts for mobile browser chrome, which is the
    // usual reason a "100vh" page still scrolls on a phone.
    <div className="flex min-h-dvh flex-col lg:grid lg:h-dvh lg:grid-cols-[1.05fr_minmax(400px,0.9fr)] lg:overflow-hidden">
      {/* Left: what this is. Hidden on small screens — on a phone the door matters
          more than the pitch, and keeping both would force a scroll. */}
      <section className="relative hidden min-w-0 flex-col justify-between overflow-hidden bg-hero px-10 py-10 text-white lg:flex xl:px-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full opacity-[0.16] blur-3xl"
          style={{ background: 'radial-gradient(circle, #0052ff 0%, transparent 70%)' }}
        />

        <header className="relative flex shrink-0 items-center gap-2.5">
          <LogoMark className="h-6 w-6 text-primary" />
          <span className="text-[16px] font-semibold tracking-[-0.02em]">conceptcast</span>
        </header>

        <div className="relative flex min-w-0 max-w-xl flex-1 flex-col justify-center py-8">
          <span className="inline-flex w-fit items-center rounded-[100px] border border-white/15 px-3 py-1 text-[12px] font-semibold text-white/70">
            For your personal LinkedIn
          </span>

          <h1 className="mt-4 text-[clamp(34px,3.4vw,52px)] leading-[1.05] tracking-[-1.4px]">
            Post mechanisms,
            <br />
            not news.
          </h1>

          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/60">
            News decays in a day. Pick a concept from the backlog and this researches it against primary sources,
            then drafts an explainer that is still correct in a year. You approve every post.
          </p>

          <div className="mt-7">
            <PipelineDiagram />
          </div>
        </div>

        <dl className="relative grid max-w-xl shrink-0 grid-cols-3 gap-6 border-t border-white/10 pt-5">
          {STATS.map(([value, label]) => (
            <div key={label}>
              <dt className="font-mono text-[19px] font-medium tabular-nums">{value}</dt>
              <dd className="mt-0.5 text-[12px] text-white/50">{label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Right: the actual door. Scrolls internally only if a very short viewport
          leaves no other option, so the page itself never does. */}
      <section className="scroll-slim flex min-h-0 flex-1 flex-col justify-center overflow-y-auto border-hairline bg-canvas px-6 py-10 sm:px-10 lg:border-l lg:px-10 lg:py-12 xl:px-12">
        <div className="mx-auto w-full max-w-md">
          {/* The brand only appears here when the hero is hidden. */}
          <div className="mb-6 flex items-center gap-2.5 sm:mb-8 lg:hidden">
            <LogoMark className="h-6 w-6 text-primary" />
            <span className="text-[16px] font-semibold tracking-[-0.02em]">conceptcast</span>
          </div>

          <LoginPanel />

          <ol className="mt-6 space-y-3.5 border-t border-hairline pt-5 sm:mt-8 sm:space-y-4 sm:pt-6">
            {STEPS.map(([n, title, body]) => (
              <li key={n} className="flex gap-3.5">
                <span className="t-number shrink-0 pt-px text-[12px] text-muted-soft">{n}</span>
                <div className="min-w-0">
                  <h2 className="text-[14px] font-semibold leading-snug">{title}</h2>
                  <p className="mt-0.5 text-[13px] leading-snug text-body">{body}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* Desktop only: it balances the taller hero column. On a short phone
              the same paragraph is what pushes the page into a scroll. */}
          <p className="mt-6 hidden border-t border-hairline pt-4 text-[12px] leading-snug text-muted-soft lg:block">
            Nothing runs on its own. You pick the topic and you approve the post.
          </p>
        </div>
      </section>
    </div>
  );
}
