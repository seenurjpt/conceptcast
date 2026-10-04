/**
 * Locks the page behind a full-screen overlay (dialog, mobile menu).
 *
 * Two jobs:
 * - Stop the page scrolling (body overflow hidden).
 * - Mark <html> with `overlay-open`, which releases the scrollbar gutters
 *   <html> reserves on both edges (see globals.css). Chromium never paints a
 *   fixed overlay into those strips, so without this they stay at full
 *   brightness beside the dimmed page.
 *
 * Reference-counted, so closing one overlay while another is still open
 * does not unlock the page. Returns the release function, which is safe to
 * call more than once, so it can be returned straight from a useEffect.
 */

let holders = 0;
let savedOverflow = '';

export function lockPage(): () => void {
  if (typeof document === 'undefined') return () => {};
  holders += 1;
  if (holders === 1) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('overlay-open');
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders -= 1;
    if (holders === 0) {
      document.body.style.overflow = savedOverflow;
      document.documentElement.classList.remove('overlay-open');
    }
  };
}
