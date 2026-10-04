'use client';

import { useRef, useState } from 'react';

/**
 * One FAQ entry: a native <details> with an animated open and close.
 *
 * The element stays a real disclosure, so without JavaScript it still opens
 * (instantly), keyboard and screen-reader behaviour is the browser's own, and
 * the answer is in the HTML for search engines and the FAQ structured data.
 *
 * With JavaScript, the summary click is taken over to animate the panel's
 * height and opacity with the Web Animations API (compositor-friendly, no
 * layout thrash per frame beyond the height itself). A click mid-animation
 * reverses smoothly from wherever the panel is. Reduced-motion visitors get
 * the instant toggle.
 */
const DURATION = 280;
const EASING = 'cubic-bezier(0.2, 0, 0, 1)';

export function FaqItem({ q, a }: { q: string; a: string }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);
  const [open, setOpen] = useState(false);

  const toggle = (e: React.MouseEvent) => {
    const details = detailsRef.current;
    const panel = panelRef.current;
    if (!details || !panel) return;
    e.preventDefault();

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const opening = !open;
    setOpen(opening);

    if (reduce || typeof panel.animate !== 'function') {
      details.open = opening;
      return;
    }

    // Start from the panel's current height, so interrupting reverses smoothly.
    const from = animRef.current ? panel.getBoundingClientRect().height : opening ? 0 : panel.scrollHeight;
    animRef.current?.cancel();

    if (opening) details.open = true;
    const to = opening ? panel.scrollHeight : 0;

    const anim = panel.animate(
      [
        { height: `${from}px`, opacity: opening ? 0 : 1 },
        { height: `${to}px`, opacity: opening ? 1 : 0 },
      ],
      { duration: DURATION, easing: EASING },
    );
    animRef.current = anim;
    anim.onfinish = () => {
      animRef.current = null;
      if (!opening) details.open = false;
    };
    anim.oncancel = () => {
      if (animRef.current === anim) animRef.current = null;
    };
  };

  return (
    <details
      ref={detailsRef}
      className="faq"
      data-open={open}
      // Keeps the icon in step when the browser opens it by itself (find in
      // page, or a no-animation path). Ignored while our own animation runs.
      onToggle={(e) => {
        if (!animRef.current) setOpen(e.currentTarget.open);
      }}
    >
      <summary onClick={toggle} className="faq-summary flex cursor-pointer items-center justify-between gap-4 py-5">
        <h3 className="text-[16px] font-semibold leading-snug">{q}</h3>
        <span aria-hidden className="faq-icon">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
      </summary>
      <div ref={panelRef} className="faq-panel">
        <p className="pb-6 pr-10 text-[15px] leading-relaxed text-body">{a}</p>
      </div>
    </details>
  );
}
