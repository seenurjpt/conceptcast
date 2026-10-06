/**
 * The app's loader: the welcome screen's logo animation, looped. Node one
 * appears, the path draws to node two and on to the last node, which lands
 * and broadcasts a ring; then the mark fades and it starts again.
 *
 * For route and app-level loading only. Data loading inside a page uses
 * skeletons, which keep the layout steady.
 *
 * It fades in after a short delay, so a fast navigation never flashes it.
 */
export function BrandLoader({ fullscreen = false, label = 'Loading' }: { fullscreen?: boolean; label?: string }) {
  return (
    <div className={`brand-loader${fullscreen ? ' is-fullscreen' : ''}`} role="status" aria-live="polite">
      <svg className="bl-mark" viewBox="-1 -1 26 26" fill="none" aria-hidden="true">
        <path className="bl-link bl-link-1" d="M5 18 L12 11.5" pathLength={1} />
        <path className="bl-link bl-link-2" d="M12 11.5 L19 6" pathLength={1} />
        <circle className="bl-node bl-node-1" cx="5" cy="18" r="3" />
        <circle className="bl-node bl-node-2" cx="12" cy="11.5" r="3" />
        <circle className="bl-ring" cx="19" cy="6" r="4" />
        <circle className="bl-node bl-node-3" cx="19" cy="6" r="4" />
      </svg>
      {fullscreen && <p className="bl-word">conceptcast</p>}
      <span className="sr-only">{label}</span>
    </div>
  );
}
