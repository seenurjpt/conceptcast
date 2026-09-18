/**
 * The actual agent chain (spec §2), drawn rather than described. Each node is a
 * real stage; the human gate is the one in brand blue, because that is the
 * point the whole design turns on.
 *
 * Laid out as two deliberate rows rather than a wrapping flex line: seven nodes
 * never fit one row at this width, and letting it wrap orphans a single node.
 */

interface Node {
  label: string;
  sub: string;
  human?: boolean;
}

const ROW_ONE: Node[] = [
  { label: 'Backlog', sub: '63 concepts' },
  { label: 'Select', sub: 'Haiku' },
  { label: 'Research', sub: 'Sonnet + search' },
];

const ROW_TWO: Node[] = [
  { label: 'Write', sub: '3 angles' },
  { label: 'Critique', sub: 'depth rubric' },
  { label: 'You', sub: 'approve', human: true },
  { label: 'LinkedIn', sub: 'publish' },
];

function Arrow({ className = '' }: { className?: string }) {
  return (
    <svg width="20" height="8" viewBox="0 0 20 8" fill="none" aria-hidden className={`shrink-0 ${className}`}>
      <path
        d="M2 4h13M12.5 1L15.5 4 12.5 7"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-white/25"
      />
    </svg>
  );
}

function Chip({ n }: { n: Node }) {
  return (
    <div
      className={`rounded-[10px] border px-2.5 py-2 ${
        n.human ? 'border-primary/60 bg-primary/15' : 'border-white/[0.12] bg-white/[0.04]'
      }`}
    >
      <div className={`text-[12px] font-semibold ${n.human ? 'text-[#8fb5ff]' : 'text-white/85'}`}>{n.label}</div>
      <div className="mt-0.5 text-[10px] text-white/40">{n.sub}</div>
    </div>
  );
}

function Row({ nodes, trailing }: { nodes: Node[]; trailing?: boolean }) {
  return (
    <li className="flex w-max items-center">
      {nodes.map((n, i) => (
        <div key={n.label} className="flex items-center">
          {i > 0 && <Arrow className="px-1" />}
          <Chip n={n} />
        </div>
      ))}
      {/* Marks the hand-off to the next row. */}
      {trailing && <Arrow className="px-1 opacity-60" />}
    </li>
  );
}

export function PipelineDiagram() {
  return (
    <figure className="w-full min-w-0">
      {/* Nodes have intrinsic width; on a phone the diagram scrolls rather than
          widening the page. */}
      <ol className="scroll-slim -mx-1 flex flex-col gap-2 overflow-x-auto px-1 pb-1">
        <Row nodes={ROW_ONE} trailing />
        <Row nodes={ROW_TWO} />
      </ol>
      <figcaption className="mt-3 text-[12px] text-white/40">
        Engagement from published posts feeds back into which concept gets picked next.
      </figcaption>
    </figure>
  );
}
