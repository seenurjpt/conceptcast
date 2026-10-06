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
let savedPadding = '';

export function lockPage(): () => void {
  if (typeof document === 'undefined') return () => {};
  holders += 1;
  if (holders === 1) {
    const body = document.body;
    const before = body.getBoundingClientRect().width;
    savedOverflow = body.style.overflow;
    savedPadding = body.style.paddingRight;
    body.style.overflow = 'hidden';
    document.documentElement.classList.add('overlay-open');
    // The signed-in app keeps its gutter on the right only, so releasing it
    // would widen the page and nudge the top bar and content sideways under
    // the dialog. Pad the body by exactly what was released instead. (The
    // public pages reserve both edges, which release evenly and stay centred.)
    if (document.querySelector('.app-shell')) {
      const grew = body.getBoundingClientRect().width - before;
      if (grew > 0) body.style.paddingRight = `${grew}px`;
    }
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders -= 1;
    if (holders === 0) {
      document.body.style.overflow = savedOverflow;
      document.body.style.paddingRight = savedPadding;
      document.documentElement.classList.remove('overlay-open');
    }
  };
}
