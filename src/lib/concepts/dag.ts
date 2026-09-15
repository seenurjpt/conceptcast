/** Prerequisite-DAG validation and selection eligibility for the concept backlog. */

export interface DagNode {
  slug: string;
  prerequisites: string[];
}

/**
 * Topologically sorts the concepts by prerequisites (Kahn's algorithm).
 * Throws on a duplicate slug, a prerequisite pointing at a slug that does
 * not exist, or a cycle. Returns the slugs in a valid publish order.
 */
export function validateDag(nodes: DagNode[]): string[] {
  const bySlug = new Map<string, DagNode>();
  for (const n of nodes) {
    if (bySlug.has(n.slug)) throw new Error(`Duplicate concept slug: "${n.slug}"`);
    bySlug.set(n.slug, n);
  }

  for (const n of nodes) {
    for (const p of n.prerequisites) {
      if (!bySlug.has(p)) {
        throw new Error(`Concept "${n.slug}" has dangling prerequisite "${p}"`);
      }
      if (p === n.slug) throw new Error(`Concept "${n.slug}" lists itself as a prerequisite`);
    }
  }

  // indegree = number of unmet prerequisites; edges go prerequisite -> dependent.
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const n of nodes) {
    indegree.set(n.slug, n.prerequisites.length);
    for (const p of n.prerequisites) {
      const list = dependents.get(p) ?? [];
      list.push(n.slug);
      dependents.set(p, list);
    }
  }

  const queue = nodes.filter((n) => n.prerequisites.length === 0).map((n) => n.slug);
  const order: string[] = [];
  while (queue.length > 0) {
    const slug = queue.shift() as string;
    order.push(slug);
    for (const dep of dependents.get(slug) ?? []) {
      const d = (indegree.get(dep) as number) - 1;
      indegree.set(dep, d);
      if (d === 0) queue.push(dep);
    }
  }

  if (order.length !== nodes.length) {
    const stuck = nodes.map((n) => n.slug).filter((s) => !order.includes(s));
    throw new Error(`Prerequisite cycle involving: ${stuck.join(', ')}`);
  }
  return order;
}

/* ── eligibility (spec §5.1: runs in code, not the LLM) ───────────────────── */

export interface EligibilityConcept extends DagNode {
  track: string;
  status: string;
}

/**
 * True when the last `run` covered tracks are all `track` — i.e. picking this
 * track again would make `run + 1` posts from the same track in a row.
 * `recentTracks` is most-recent first.
 */
export function recentlyCoveredTrack(track: string, recentTracks: string[], run = 2): boolean {
  if (recentTracks.length < run) return false;
  return recentTracks.slice(0, run).every((t) => t === track);
}

/**
 * Eligible = in the backlog, every prerequisite published, and the track is
 * not the one that produced the last two posts.
 */
export function eligibleConcepts<T extends EligibilityConcept>(
  concepts: T[],
  publishedSlugs: Set<string>,
  recentTracks: string[],
): T[] {
  return concepts.filter(
    (c) =>
      c.status === 'backlog' &&
      c.prerequisites.every((p) => publishedSlugs.has(p)) &&
      !recentlyCoveredTrack(c.track, recentTracks, 2),
  );
}
