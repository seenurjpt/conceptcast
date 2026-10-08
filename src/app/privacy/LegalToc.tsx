'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/**
 * The privacy policy's contents list, highlighting the section being read.
 *
 * "Being read" is the last section whose heading has scrolled past a line
 * just under the floating nav; at the very bottom of the page the last
 * section wins, since a short final section never reaches that line. The
 * highlight slides between items. Scroll work is batched to one check per
 * frame.
 */

/** Where reading happens: below the floating nav (about 90px) plus a margin. */
const READ_LINE = 140;

export function LegalToc({ sections }: { sections: readonly (readonly [string, string])[] }) {
  const [active, setActive] = useState<string>(sections[0]?.[0] ?? '');
  const reduce = useReducedMotion();

  useEffect(() => {
    let frame = 0;
    const els = sections.map(([id]) => document.getElementById(id)).filter((e): e is HTMLElement => Boolean(e));
    const check = () => {
      frame = 0;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current = els[0]?.id ?? '';
      if (atBottom) current = els[els.length - 1]?.id ?? current;
      else for (const el of els) if (el.getBoundingClientRect().top <= READ_LINE) current = el.id;
      setActive((prev) => (prev === current ? prev : current));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [sections]);

  return (
    <nav aria-label="On this page" className="legal-toc">
      <p className="label">On this page</p>
      <ol>
        {sections.map(([id, title]) => {
          const on = id === active;
          return (
            <li key={id}>
              <a href={`#${id}`} aria-current={on ? 'location' : undefined} className={on ? 'is-active' : undefined} onClick={() => setActive(id)}>
                {on && (
                  <motion.span
                    layoutId="legal-toc-pill"
                    className="legal-toc-pill"
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
                    aria-hidden
                  />
                )}
                <span className="relative">{title}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
