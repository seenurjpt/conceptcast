import Link from 'next/link';

/**
 * The landing hero: an eclipse in the app's own colours. A dark disc sits
 * above the fold with the app's blue breaking around its rim, and the
 * headline sits in the light underneath.
 *
 * Palette and type come straight from the app: near-black surface, white
 * headline, the primary blue for the second line and the button, the grey
 * body colour for the supporting line. Nothing here exists only on this page.
 *
 * Everything is CSS (gradients and box-shadows painted once), so there is no
 * image to download and no JavaScript to run. The only motion is the ring
 * rising in and its light slowly breathing; both are transform/opacity and
 * stop for visitors who ask for reduced motion. Dark in both themes on
 * purpose: a glow needs a dark sky.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="lp-cine">
      <div aria-hidden className="lp-stars" />
      <div aria-hidden className="lp-ring" />
      <div aria-hidden className="lp-horizon" />

      <div className="lp-cine-content">
        <h1 id="hero-title" className="lp-cine-title">
          Post what you are learning.
          <br />
          <span className="lp-cine-accent">Researched, not recalled.</span>
        </h1>

        <p className="lp-cine-lede">
          Name a topic and conceptcast researches it on the web, drafts a LinkedIn post in your voice, and waits for your
          approval.
        </p>

        <div className="lp-cine-actions">
          <Link href="/login" className="btn btn-primary lp-cine-cta">
            Continue with LinkedIn
            <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <a href="#how" className="btn lp-cine-ghost">
            How it works
          </a>
        </div>

        <p className="lp-cine-note">Bring your own AI key. Nothing is posted without your click.</p>
      </div>
    </section>
  );
}
