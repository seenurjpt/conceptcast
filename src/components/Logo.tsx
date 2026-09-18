/**
 * The mark: three nodes on a rising path, the last one filled.
 *
 * It is the prerequisite graph — the mechanic the whole app turns on. Concepts
 * unlock in order and the final one ships, so the filled node is the published
 * post. Reads equally as a graph, a rising signal, and a broadcast.
 *
 * Built from two strokes and three circles so it survives 16px, where anything
 * with interior detail turns to mush.
 */

export function LogoMark({ className = '', title }: { className?: string; title?: string }) {
  return (
    <svg
      // Slightly wider than the artwork so the outer nodes are not flush to the
      // edge; keeps the mark optically aligned beside text.
      viewBox="-1 -1 26 26"
      fill="none"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {/*
        Weights tuned by rendering at 16px: heavy nodes and a thin connector
        stay legible where an even-weight version smears into one diagonal.
      */}
      <path
        d="M5 18 L12 11.5 L19 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <circle cx="5" cy="18" r="3" fill="currentColor" opacity="0.6" />
      <circle cx="12" cy="11.5" r="3" fill="currentColor" opacity="0.8" />
      {/* The published post: full weight, and the largest node. */}
      <circle cx="19" cy="6" r="4" fill="currentColor" />
    </svg>
  );
}

/** Mark plus wordmark, as used in the nav and on the login screen. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <LogoMark className="h-6 w-6 shrink-0 text-primary" />
      <span className="text-[16px] font-semibold tracking-[-0.02em]">conceptcast</span>
    </span>
  );
}
