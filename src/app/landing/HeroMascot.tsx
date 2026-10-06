'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LandingMascot } from './LandingMascot';

/**
 * The hero's drone, with something to say. A speech bubble beside it types
 * out one short line at a time about what the app does, holds it, and moves
 * on. Clicking the drone interrupts with a reaction line (four quick clicks:
 * dizzy, matching its dizzy face), then the tour picks up where it left off.
 *
 * The bubble is decoration that repeats the page's own claims, so it is
 * hidden from screen readers rather than announcing every few seconds. It
 * pauses while the hero is off screen or the tab is hidden, and with
 * reduced motion each line appears whole instead of being typed.
 */

const LINES = [
  "Hi, I'm Cast. I do the research.",
  'Name a topic. I find the sources.',
  'Every claim in a draft comes with its source.',
  'I write in your voice, not mine.',
  'Nothing posts until you approve it.',
  'Bring your own AI key. I run cheap.',
  'Go on, boop me.',
];
const BOOPS = ['Beep boop!', 'Hey, that tickles.', "Okay, I'm awake!", 'Again? Fine.'];
const DIZZY = 'Whoa. Everything is spinning.';

const TYPE_MS = 32;
const HOLD_MS = 3200;
const GAP_MS = 450;
const FIRST_DELAY_MS = 600;
const BOOP_HOLD_MS = 1800;
const DIZZY_AFTER = 4;
const DIZZY_WINDOW_MS = 1600;

export function HeroMascot() {
  const [ready, setReady] = useState(false);
  const [text, setText] = useState('');
  // The whole line, laid out invisibly under the typed part so the bubble
  // takes its final size at once instead of growing letter by letter.
  const [full, setFull] = useState('');
  const [shown, setShown] = useState(false);
  const [tone, setTone] = useState<'tour' | 'boop'>('tour');
  const lineRef = useRef(0);
  const timers = useRef<number[]>([]);
  const boops = useRef({ count: 0, at: 0, n: 0 });
  const active = useRef(true);
  const reduce = useRef(false);
  const wrap = useRef<HTMLDivElement>(null);

  const clear = () => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  };
  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  /** Types `line` out, holds it, then calls `then`. */
  const say = useCallback((line: string, hold: number, then: () => void) => {
    clear();
    setFull(line);
    setShown(true);
    if (reduce.current) {
      setText(line);
      later(hold, then);
      return;
    }
    let i = 0;
    setText('');
    const tick = () => {
      i += 1;
      setText(line.slice(0, i));
      if (i < line.length) later(TYPE_MS, tick);
      else later(hold, then);
    };
    later(TYPE_MS, tick);
  }, []);

  const tour = useCallback(() => {
    if (!active.current) return;
    const line = LINES[lineRef.current % LINES.length];
    setTone('tour');
    say(line, HOLD_MS, () => {
      setShown(false);
      lineRef.current += 1;
      later(GAP_MS, tour);
    });
  }, [say]);

  // Start once the drone is on screen; pause off screen or in a hidden tab.
  useEffect(() => {
    if (!ready) return;
    reduce.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let visible = true;
    const sync = () => {
      const should = visible && document.visibilityState === 'visible';
      if (should && !active.current) {
        active.current = true;
        tour();
      } else if (!should && active.current) {
        active.current = false;
        clear();
        setShown(false);
      }
    };
    active.current = true;
    later(FIRST_DELAY_MS, tour);
    const io =
      typeof IntersectionObserver !== 'undefined' && wrap.current
        ? new IntersectionObserver((entries) => {
            visible = entries.some((e) => e.isIntersecting);
            sync();
          })
        : null;
    if (io && wrap.current) io.observe(wrap.current);
    document.addEventListener('visibilitychange', sync);
    return () => {
      io?.disconnect();
      document.removeEventListener('visibilitychange', sync);
      clear();
    };
  }, [ready, tour]);

  const onBoop = () => {
    const now = Date.now();
    const b = boops.current;
    b.count = now - b.at < DIZZY_WINDOW_MS ? b.count + 1 : 1;
    b.at = now;
    setTone('boop');
    if (b.count >= DIZZY_AFTER) {
      b.count = 0;
      say(DIZZY, BOOP_HOLD_MS, tour);
    } else {
      say(BOOPS[b.n++ % BOOPS.length], BOOP_HOLD_MS, tour);
    }
  };

  return (
    <div ref={wrap} className="hero-mascot">
      <LandingMascot load="idle" size={128} sizeSmall={96} className="is-hero" onReady={() => setReady(true)} onBoop={onBoop} />
      <div className={`hero-bubble${shown && text ? ' is-shown' : ''}${tone === 'boop' ? ' is-boop' : ''}`} aria-hidden>
        <span className="hero-bubble-size">{full}</span>
        <span className="hero-bubble-text">
          {text}
          <span className="hero-bubble-caret" />
        </span>
      </div>
    </div>
  );
}
