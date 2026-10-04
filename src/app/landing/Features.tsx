/**
 * "What makes it different": an editorial two-column layout. The heading and
 * a short intro sit on the left (and stay in view on desktop); the six
 * points form a quiet two-column list on the right, each with a small icon,
 * separated by hairlines rather than boxed in cards.
 *
 * Deliberately restrained: no illustrations, no scroll motion. One hover
 * touch (the icon tile fills with the primary blue). App tokens only, so it
 * follows light and dark mode.
 */

type Feature = { title: string; body: string; icon: React.ReactNode };

const FEATURES: Feature[] = [
  {
    title: 'Mechanisms, not news',
    body: 'Posts explain how something works and why it matters, so they are still correct in a year. News decays in a day.',
    icon: (
      <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Zm-9 9 9 4.5 9-4.5M3 16.5 12 21l9-4.5" />
    ),
  },
  {
    title: 'Research first',
    body: 'Nothing is written from memory. The researcher reads papers, docs and code, then hands the writer sourced facts only.',
    icon: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4.4-4.4" />
      </>
    ),
  },
  {
    title: 'Your voice',
    body: 'Paste a handful of your own posts once. The writer copies the shape and rhythm, never the content.',
    icon: (
      <path d="M7.5 10.5h-3V7a3 3 0 0 1 3-3M7.5 10.5V17h-3v-6.5M16.5 10.5h-3V7a3 3 0 0 1 3-3M16.5 10.5V17h-3v-6.5" />
    ),
  },
  {
    title: 'A critic that says no',
    body: 'Every draft is scored on depth, surprise and applicability. Anything that would embarrass you never reaches your queue.',
    icon: (
      <>
        <path d="M12 3 4.5 6v5.5c0 4.4 3.1 8.3 7.5 9.5 4.4-1.2 7.5-5.1 7.5-9.5V6L12 3Z" />
        <path d="m8.8 12 2.2 2.2 4.2-4.4" />
      </>
    ),
  },
  {
    title: 'Your key, your cost',
    body: 'Bring an Anthropic, OpenAI or Gemini key. Gemini has a free tier, so the whole loop can cost nothing.',
    icon: (
      <>
        <circle cx="8" cy="15" r="4.5" />
        <path d="m11.2 11.8 8.3-8.3M16.5 6.5l2.5 2.5M14 9l2 2" />
      </>
    ),
  },
  {
    title: 'You approve every post',
    body: 'Nothing runs on a schedule and nothing is published without your click. The app drafts; you decide.',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="m8.3 12.2 2.5 2.5 5-5.2" />
      </>
    ),
  },
];

export function Features() {
  return (
    <section aria-labelledby="diff-title" className="cv-auto border-b border-hairline bg-surface-soft">
      <div className="mx-auto grid max-w-[1120px] gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="label">What makes it different</p>
          <h2
            id="diff-title"
            className="mt-2 text-[clamp(28px,3.4vw,40px)] font-semibold leading-[1.1] tracking-[-0.03em] [text-wrap:balance]"
          >
            Built to be wrong <span className="text-primary">less often than you are.</span>
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-body sm:text-[16px]">
            Every post passes through research, a critic and you before it reaches your feed. Here is what that buys
            you.
          </p>
        </div>

        <ul className="grid gap-x-10 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="feat border-t border-hairline py-7">
              <span aria-hidden className="feat-icon">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {f.icon}
                </svg>
              </span>
              <h3 className="mt-4 text-[16px] font-semibold leading-snug">{f.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-body">{f.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
