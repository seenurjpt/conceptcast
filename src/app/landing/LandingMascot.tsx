'use client';

import { useEffect, useRef, useState } from 'react';
import { Mascot } from 'page-mascot';

/**
 * The landing page's drone: it turns to follow the reader's cursor and
 * reacts when clicked (blink, then a heart, a sparkle or a grin; four quick
 * clicks make it dizzy). From page-mascot by Kamran Ahmed, MIT; the sheets
 * are in public/mascots with the licence beside them.
 *
 * Kept off the critical path:
 * - `load="idle"` (on screen at once, like the hero): waits for the page's
 *   load event and an idle moment, so the headline paints first.
 * - `load="near"`: nothing loads until it is within a screen of the viewport.
 * Both sheets are fetched before it shows (no half-drawn frame), and its box
 * is reserved from the start so nothing shifts. Head tracking only runs with
 * a fine pointer; on touch it is a tap-to-react character.
 */

const DIRECTIONS = '/mascots/drone-directions.webp';
const REACTIONS = '/mascots/drone-reactions.webp';

function preload(src: string) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = src;
  });
}

export function LandingMascot({
  size = 112,
  sizeSmall = size,
  load = 'near',
  className = '',
  onReady,
  onBoop,
}: {
  size?: number;
  /** Below 640px. */
  sizeSmall?: number;
  load?: 'near' | 'idle';
  className?: string;
  /** Once both sheets are in and it is on screen. */
  onReady?: () => void;
  /** Each click or tap. */
  onBoop?: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [go, setGo] = useState(false);
  const [ready, setReady] = useState(false);
  const [px, setPx] = useState(size);

  useEffect(() => {
    const small = window.matchMedia('(max-width: 639px)');
    const pick = () => setPx(small.matches ? sizeSmall : size);
    pick();
    small.addEventListener('change', pick);
    return () => small.removeEventListener('change', pick);
  }, [size, sizeSmall]);

  // When to start fetching.
  useEffect(() => {
    if (load === 'idle') {
      let idle = 0;
      let timer = 0;
      const start = () => {
        // Safari has no requestIdleCallback; a short timeout after load stands in.
        if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(() => setGo(true), { timeout: 1500 });
        else timer = window.setTimeout(() => setGo(true), 300);
      };
      if (document.readyState === 'complete') start();
      else window.addEventListener('load', start, { once: true });
      return () => {
        window.removeEventListener('load', start);
        if (idle) window.cancelIdleCallback(idle);
        window.clearTimeout(timer);
      };
    }
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setGo(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setGo(true);
          io.disconnect();
        }
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [load]);

  useEffect(() => {
    if (!go) return;
    let live = true;
    void Promise.all([preload(DIRECTIONS), preload(REACTIONS)]).then(() => {
      if (!live) return;
      setReady(true);
      onReady?.();
    });
    return () => {
      live = false;
    };
    // onReady is a notification; a new function identity must not reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go]);

  return (
    <div ref={box} className={`landing-mascot ${className}`} style={{ width: px, height: px }} onClickCapture={() => onBoop?.()}>
      {ready && (
        // Two wrappers: the idle float and the entrance pop each animate
        // their own element, so neither overrides the other's transform.
        <div className="landing-mascot-float">
          <div className="landing-mascot-in">
            <Mascot directions={DIRECTIONS} reactions={REACTIONS} size={px} label="conceptcast drone" />
          </div>
        </div>
      )}
    </div>
  );
}
