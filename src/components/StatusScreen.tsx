import Link from 'next/link';
import { LogoMark } from './Logo';

/**
 * The not-found and error screens. Both are drawn from the logo, three
 * nodes on a path (concepts, in order, to a published post):
 *
 * - lost:   the path runs out after the second node; the last one has
 *           drifted off on its own, hollow, bobbing just out of reach.
 * - broken: the path snaps between the second and third node with a small
 *           spark, and the last node pulses in the danger colour.
 *
 * `fullscreen` is for pages outside the app's chrome (a mistyped URL, a
 * crash in the root layout); without it the screen sits in the content
 * area, under the sidebar and top bar.
 */
export function StatusScreen({
  variant,
  code,
  title,
  children,
  actions,
  fullscreen = false,
  footnote,
}: {
  variant: 'lost' | 'broken';
  code: string;
  title: string;
  children: React.ReactNode;
  actions: React.ReactNode;
  fullscreen?: boolean;
  footnote?: React.ReactNode;
}) {
  return (
    <main className={`status-screen${fullscreen ? ' is-fullscreen' : ''}`}>
      {fullscreen && (
        <Link href="/" className="status-brand" aria-label="conceptcast home">
          <LogoMark className="h-6 w-6 text-primary" />
          <span className="t-title-sm tracking-[-0.02em]">conceptcast</span>
        </Link>
      )}
      <div className="status-body">
        {variant === 'lost' ? <LostArt /> : <BrokenArt />}
        <p className={`status-code is-${variant}`}>{code}</p>
        <h1 className="status-title">{title}</h1>
        <div className="status-text">{children}</div>
        <div className="status-actions">{actions}</div>
        {footnote && <div className="status-foot">{footnote}</div>}
      </div>
    </main>
  );
}

function LostArt() {
  return (
    <svg className="status-art is-lost" viewBox="0 0 160 120" fill="none" aria-hidden="true">
      <path className="sa-link" d="M28 92 L72 58" />
      <path className="sa-trail" d="M72 58 L104 34" />
      <circle className="sa-node sa-node-1" cx="28" cy="92" r="9" />
      <circle className="sa-node sa-node-2" cx="72" cy="58" r="9" />
      <g className="sa-drift">
        <circle className="sa-lost" cx="128" cy="26" r="12" />
        <circle className="sa-lost-dot" cx="128" cy="26" r="2.5" />
      </g>
    </svg>
  );
}

function BrokenArt() {
  return (
    <svg className="status-art is-broken" viewBox="0 0 160 120" fill="none" aria-hidden="true">
      <path className="sa-link" d="M28 92 L72 58" />
      <path className="sa-link" d="M72 58 L88 46" />
      <path className="sa-link sa-link-far" d="M106 33 L120 22" />
      <path className="sa-spark" d="M93 37 l4 5 l2 -6 l4 4" />
      <circle className="sa-node sa-node-1" cx="28" cy="92" r="9" />
      <circle className="sa-node sa-node-2" cx="72" cy="58" r="9" />
      <circle className="sa-ring" cx="128" cy="16" r="12" />
      <circle className="sa-bad" cx="128" cy="16" r="12" />
    </svg>
  );
}
