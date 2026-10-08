import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_AUTHOR, SITE_NAME } from '@/lib/site';
import { PublicPage } from '../landing/PublicPage';
import { GitHubMark, LinkedInMark } from '../landing/SiteFooter';

export const dynamic = 'force-static';

const DESCRIPTION =
  'Why conceptcast exists, how it turns a topic you are learning into a researched LinkedIn post, and the principles it is built on.';

export const metadata: Metadata = {
  title: 'About',
  description: DESCRIPTION,
  alternates: { canonical: '/about' },
  openGraph: { type: 'website', url: '/about', siteName: SITE_NAME, title: `About · ${SITE_NAME}`, description: DESCRIPTION },
};

const STEPS = [
  ['Name a topic', 'Something you are learning. conceptcast suggests the subtopics worth a post each, and you keep the ones you want.'],
  ['It researches', 'For each subtopic it searches the web and reads the sources, collecting facts with the page each one came from.'],
  ['It drafts in your voice', 'A post written from that research, using the style notes and example posts you gave it, then scored by a critic before you see it.'],
  ['You decide', 'Read the draft beside its sources. Edit it, rewrite it, reject it, or approve it to publish now or at a time you pick.'],
] as const;

const PRINCIPLES = [
  ['Researched, not recalled', 'Posts are written from sources it read for that post, not from what a model happens to remember. Every claim in a draft comes with where it was found.'],
  ['Nothing posts without you', 'There is no autopilot. A draft goes to LinkedIn only after you approve it, and you can always edit it first.'],
  ['Your voice, not a template', 'It learns how you write from your own posts, and avoids the filler phrases that make AI posts easy to spot.'],
  ['Your key, your cost', 'It runs on your own Anthropic, OpenAI or Google Gemini key, so you pay what the model costs and nothing more.'],
] as const;

export default function AboutPage() {
  return (
    <PublicPage
      eyebrow="About"
      title={
        <>
          Learning in public, <span className="text-primary">without the busywork.</span>
        </>
      }
      lede="conceptcast helps you post what you are learning on LinkedIn: one well-researched explainer at a time, written in your voice, and never published without your approval."
    >
      {/* Why */}
      <section aria-labelledby="why-title" className="border-b border-hairline">
        <div className="mx-auto grid max-w-[1120px] gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <p className="label">Why it exists</p>
            <h2 id="why-title" className="mt-2 text-[clamp(26px,3.4vw,38px)] leading-tight tracking-[-0.8px]">
              Explaining a thing is the best way to learn it
            </h2>
          </div>
          <div className="space-y-4 text-[15px] leading-relaxed text-body">
            <p>
              Writing up what you learn makes it stick, and sharing it builds a public record of how you think. But a good
              explainer takes hours: reading the sources, checking the details, finding the one example that makes it
              click, and then saying it in a few hundred words.
            </p>
            <p>
              Most people skip it, or post something thin. AI writing tools make that worse: they produce confident posts
              from memory, with no sources and a voice that belongs to nobody.
            </p>
            <p>
              conceptcast does the slow part, the research and the first draft, and leaves the part that matters to you:
              deciding whether it is right and whether it sounds like you.
            </p>
          </div>
        </div>
      </section>

      {/* How */}
      <section aria-labelledby="how-title" className="border-b border-hairline bg-surface-soft">
        <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-20">
          <p className="label">How it works</p>
          <h2 id="how-title" className="mt-2 text-[clamp(26px,3.4vw,38px)] leading-tight tracking-[-0.8px]">
            From a topic to a post you are proud of
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="about-step">
                <span className="about-step-num" aria-hidden>
                  {i + 1}
                </span>
                <h3 className="mt-4 text-[16px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-body">{body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-[14px] text-body">
            Prefer to write it yourself? The composer lets you write your own post, polish it with AI, and publish or
            schedule it the same way.
          </p>
        </div>
      </section>

      {/* Principles */}
      <section aria-labelledby="principles-title" className="border-b border-hairline">
        <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-20">
          <p className="label">What it stands for</p>
          <h2 id="principles-title" className="mt-2 text-[clamp(26px,3.4vw,38px)] leading-tight tracking-[-0.8px]">
            Four promises it is built around
          </h2>
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {PRINCIPLES.map(([title, body]) => (
              <li key={title} className="about-principle">
                <span className="about-principle-mark" aria-hidden />
                <div>
                  <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-body">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Who */}
      <section aria-labelledby="who-title" className="border-b border-hairline bg-surface-soft">
        <div className="mx-auto grid max-w-[1120px] gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1.15fr] lg:items-center">
          <div>
            <p className="label">Who is behind it</p>
            <h2 id="who-title" className="mt-2 text-[clamp(26px,3.4vw,38px)] leading-tight tracking-[-0.8px]">
              Built by {SITE_AUTHOR.name}
            </h2>
          </div>
          <div className="space-y-4 text-[15px] leading-relaxed text-body">
            <p>
              conceptcast is an independent project by {SITE_AUTHOR.name}, a developer who wanted a way to learn in public
              without spending every evening writing. It is built with Next.js, MongoDB and the AI provider you choose.
            </p>
            <p>
              Questions, feedback or ideas? Connect on LinkedIn and send a message.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href={SITE_AUTHOR.linkedin} target="_blank" rel="noopener noreferrer me author" className="btn btn-primary">
                <LinkedInMark size={16} />
                Connect on LinkedIn
                <span className="sr-only">(opens in a new tab)</span>
              </a>
              <a href={SITE_AUTHOR.url} target="_blank" rel="noopener noreferrer me" className="btn btn-quiet">
                <GitHubMark size={16} />
                GitHub
                <span className="sr-only">(opens in a new tab)</span>
              </a>
              <Link href="/privacy" className="btn btn-quiet">
                How your data is handled
              </Link>
            </div>
            <p className="text-[13px] text-muted">
              The landing page drone is from{' '}
              <a href="https://koboyo.com/page-mascot" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
                page-mascot
              </a>{' '}
              by Kamran Ahmed, used under the MIT licence.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section aria-labelledby="about-cta" className="lp-hero">
        <div className="mx-auto max-w-[1120px] px-4 py-16 text-center sm:px-6 sm:py-20">
          <h2 id="about-cta" className="mx-auto max-w-2xl text-[clamp(26px,3.6vw,40px)] leading-tight tracking-[-0.8px]">
            Pick something you are learning. Post about it this week.
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/login" className="btn btn-primary h-11 px-7 text-[15px]">
              Continue with LinkedIn
            </Link>
            <Link href="/#how" className="btn btn-quiet h-11 px-6 text-[15px]">
              See how it works
            </Link>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
