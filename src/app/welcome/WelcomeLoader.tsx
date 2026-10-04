'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * The post-sign-in loader: the logo builds itself the way the mark describes
 * the app. Node one appears, the path draws to node two, then on to the last
 * and largest node, which lands filled and sends out a ring: concepts unlock
 * in order and the final one ships.
 *
 * Plays once (about two seconds), then replaces itself with the destination
 * so Back never returns here. With reduced motion it shows the finished mark
 * and moves on quickly.
 */

/** When the content starts fading out, and when we navigate. */
const EXIT_AT_MS = 1_850;
const LEAVE_AT_MS = 2_150;
const REDUCED_LEAVE_AT_MS = 600;

export function WelcomeLoader({ next }: { next: string }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    router.prefetch(next);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const exit = reduced ? null : window.setTimeout(() => setLeaving(true), EXIT_AT_MS);
    const leave = window.setTimeout(() => router.replace(next), reduced ? REDUCED_LEAVE_AT_MS : LEAVE_AT_MS);
    return () => {
      if (exit) window.clearTimeout(exit);
      window.clearTimeout(leave);
    };
  }, [next, router]);

  return (
    <main className={`welcome${leaving ? ' welcome-leaving' : ''}`}>
      <div className="welcome-stage" role="status" aria-live="polite">
        <svg className="welcome-mark" viewBox="-1 -1 26 26" fill="none" aria-hidden="true">
          {/* The two halves of the logo's path, drawn one after the other. */}
          <path className="welcome-link welcome-link-1" d="M5 18 L12 11.5" pathLength={1} />
          <path className="welcome-link welcome-link-2" d="M12 11.5 L19 6" pathLength={1} />
          <circle className="welcome-node welcome-node-1" cx="5" cy="18" r="3" />
          <circle className="welcome-node welcome-node-2" cx="12" cy="11.5" r="3" />
          {/* The broadcast: rings leaving the published post. */}
          <circle className="welcome-ring welcome-ring-1" cx="19" cy="6" r="4" />
          <circle className="welcome-ring welcome-ring-2" cx="19" cy="6" r="4" />
          <circle className="welcome-node welcome-node-3" cx="19" cy="6" r="4" />
        </svg>
        <p className="welcome-word">conceptcast</p>
        <p className="welcome-caption">Getting your topics ready</p>
        <span className="sr-only">Signed in. Opening your topics.</span>
      </div>
    </main>
  );
}
