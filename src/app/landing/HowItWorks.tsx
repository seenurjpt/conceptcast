/**
 * "How it works" as a timeline: four steps on a rail, each with a small
 * product illustration. The rail's nodes carry the section's point: you are
 * the first step and the last (filled in the primary blue), conceptcast does
 * the two in between.
 *
 * Illustrations are plain HTML and CSS built from the app's theme tokens, so
 * they follow light and dark mode and cost no image downloads. They are
 * decorative (the step text says the same thing), so screen readers skip them.
 *
 * Motion is CSS scroll-driven (the rail fills and the cards rise as the
 * section scrolls in). Browsers without scroll timelines, and visitors who
 * prefer reduced motion, see the finished state. No JavaScript.
 */

type Step = {
  n: string;
  who: 'you' | 'app';
  title: string;
  body: string;
  visual: React.ReactNode;
};

const STEPS: Step[] = [
  {
    n: '01',
    who: 'you',
    title: 'Name what you are learning',
    body: 'System design, Postgres internals, Kubernetes, or anything else. It suggests about ten subtopics, or you add your own.',
    visual: <TopicVisual />,
  },
  {
    n: '02',
    who: 'app',
    title: 'Pick a subtopic, click Write a post',
    body: 'It researches that one idea on the web against primary sources. Every fact carries a URL; shaky ones are dropped.',
    visual: <ResearchVisual />,
  },
  {
    n: '03',
    who: 'app',
    title: 'It drafts and critiques itself',
    body: 'Three angles, scored against a depth rubric. Weak drafts get killed, not shipped. One revision pass if needed.',
    visual: <CritiqueVisual />,
  },
  {
    n: '04',
    who: 'you',
    title: 'You decide what goes out',
    body: 'The draft waits with its sources one click away. Publish to LinkedIn, edit it, or bin it.',
    visual: <ApproveVisual />,
  },
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="cv-auto scroll-mt-24 border-b border-hairline">
      <div className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <p className="label">How it works</p>
          <h2 id="how-title" className="mt-2 text-[clamp(28px,3.6vw,42px)] font-semibold leading-[1.1] tracking-[-0.03em]">
            Four steps. <span className="text-primary">You are at both ends.</span>
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-body sm:text-[16px]">
            You choose the topic and you approve the post. conceptcast does the research, the writing and the critique in
            between.
          </p>
        </div>

        <div className="hiw">
          <div aria-hidden className="hiw-rail">
            <span className="hiw-rail-fill" />
          </div>
          <ol className="hiw-list">
          {STEPS.map((s, i) => (
            <li key={s.n} className="hiw-step" style={{ ['--i' as string]: i }}>
              <div className="hiw-head">
                <span className={`hiw-node ${s.who === 'you' ? 'is-you' : ''}`}>{s.n}</span>
                <span className={`hiw-tag ${s.who === 'you' ? 'is-you' : ''}`}>{s.who === 'you' ? 'You' : 'conceptcast'}</span>
              </div>
              <div className="hiw-card">
                <div aria-hidden className="hiw-visual">
                  {s.visual}
                </div>
                <h3 className="mt-5 text-[17px] font-semibold leading-snug">{s.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-body">{s.body}</p>
              </div>
            </li>
          ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ── illustrations ───────────────────────────────────────────────────────── */

function TopicVisual() {
  return (
    <div className="flex h-full flex-col">
      <div className="rounded-[10px] border border-primary bg-surface-card px-3 py-2 shadow-[0_0_0_3px_rgba(0,82,255,0.12)]">
        <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">Topic</p>
        <p className="mt-0.5 flex items-center text-[13px] font-semibold text-ink">
          System design
          <span className="hiw-caret" />
        </p>
      </div>
      <p className="mt-3 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">Suggested subtopics</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {['Replication lag', 'Backpressure', 'Split-brain'].map((c) => (
          <span key={c} className="rounded-full border border-hairline bg-surface-card px-2 py-0.5 text-[10.5px] text-body">
            {c}
          </span>
        ))}
        <span className="rounded-full bg-primary px-2 py-0.5 text-[10.5px] font-semibold text-on-primary">+7 more</span>
      </div>
    </div>
  );
}

function ResearchVisual() {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2 rounded-[10px] border border-hairline bg-surface-card px-2.5 py-2">
        <p className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-ink">Split-brain: when consensus breaks</p>
        <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-on-primary">Write a post</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-hairline">
        <span className="hiw-progress block h-full rounded-full bg-primary" />
      </div>
      {[
        ['raft.github.io', '/raft.pdf'],
        ['etcd.io', '/docs/v3.5/faq'],
      ].map(([host, path]) => (
        <div key={host} className="flex items-center gap-2 rounded-[8px] bg-surface-card px-2 py-1.5">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-hairline text-[8.5px] font-bold uppercase text-ink">
            {host[0]}
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-body">
            {host}
            <span className="text-muted">{path}</span>
          </span>
          <svg className="h-3 w-3 shrink-0 text-up" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ))}
    </div>
  );
}

function CritiqueVisual() {
  const rows: { angle: string; score: string; verdict: string; tone: 'win' | 'mid' | 'kill' }[] = [
    { angle: 'Mechanism', score: '8', verdict: 'winner', tone: 'win' },
    { angle: 'Tradeoff', score: '7', verdict: 'runner-up', tone: 'mid' },
    { angle: 'Misconception', score: '5', verdict: 'killed', tone: 'kill' },
  ];
  return (
    <div className="flex h-full flex-col justify-between gap-1.5">
      {rows.map((r) => (
        <div
          key={r.angle}
          className={`flex flex-1 items-center gap-1.5 rounded-[10px] border bg-surface-card px-2 ${
            r.tone === 'win' ? 'border-primary shadow-[0_0_0_3px_rgba(0,82,255,0.12)]' : 'border-hairline'
          }`}
        >
          <span className={`min-w-0 flex-1 truncate text-[11px] font-semibold ${r.tone === 'kill' ? 'text-muted' : 'text-ink'}`}>
            {r.angle}
          </span>
          <span
            className={`shrink-0 font-mono text-[12.5px] font-medium ${
              r.tone === 'win' ? 'text-primary' : r.tone === 'kill' ? 'text-down line-through' : 'text-ink'
            }`}
          >
            {r.score}/10
          </span>
          {/* Only the winner gets a pill; the struck-through red score already says "killed". */}
          {r.tone === 'win' && (
            <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[9.5px] font-semibold text-on-primary">
              {r.verdict}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function ApproveVisual() {
  return (
    <div className="flex h-full flex-col rounded-[10px] border border-hairline bg-surface-card p-2.5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-on-primary">
          Y
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold leading-tight text-ink">You</p>
          <p className="text-[9.5px] leading-tight text-muted">Draft · 8/10 · 3 sources</p>
        </div>
      </div>
      <div className="mt-2.5 space-y-1.5">
        <span className="block h-1.5 w-[92%] rounded-full bg-hairline" />
        <span className="block h-1.5 w-full rounded-full bg-hairline" />
        <span className="block h-1.5 w-[70%] rounded-full bg-hairline" />
      </div>
      <div className="mt-auto flex items-center gap-1.5 pt-2">
        <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold text-on-primary">Approve &amp; publish</span>
        <span className="rounded-full border border-hairline px-2.5 py-1 text-[10px] font-semibold text-ink">Edit</span>
      </div>
    </div>
  );
}
