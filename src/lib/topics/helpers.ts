/**
 * Pure helpers for the topic → subtopic model. No database, no network, so
 * they are unit-tested directly and safe to import from client code.
 */

/** Kebab-case, ASCII-only, never empty. */
export function slugify(s: string): string {
  const out = s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return out || 'topic';
}

/** `base`, else `base-2`, `base-3`…: the first not in `taken`. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const s = `${base}-${i}`;
    if (!taken.has(s)) return s;
  }
  return `${base}-${Date.now()}`;
}

/**
 * The seven legacy tracks, as the main topics they migrate into. A track was
 * always a parent grouping in disguise; this makes it explicit.
 */
export const TRACK_TOPICS: Record<string, { title: string; description: string }> = {
  'coding-agents': {
    title: 'Coding agents',
    description: 'Claude Code, Codex, Cursor agents, Copilot agent: how they work and behave.',
  },
  workflow: {
    title: 'Workflow',
    description: 'Spec-first, plan-then-execute, and the prompting patterns that hold up.',
  },
  'codegen-quality': {
    title: 'Codegen quality',
    description: 'Reviewing, testing and trusting generated code.',
  },
  tooling: {
    title: 'Tooling',
    description: 'MCP servers, IDE integrations, benchmarks, the tool ecosystem.',
  },
  'team-practice': {
    title: 'Team practice',
    description: 'What changes for a team: norms, onboarding, ownership.',
  },
  economics: {
    title: 'Economics',
    description: 'Cost, speed, and what a token actually buys you.',
  },
  risk: {
    title: 'Risk',
    description: 'Security, correctness, and the ways AI-written code fails.',
  },
};

export function trackTopic(track: string): { slug: string; title: string; description: string } | null {
  const meta = TRACK_TOPICS[track];
  return meta ? { slug: track, ...meta } : null;
}

/** Case- and punctuation-insensitive key for "is this the same subtopic". */
export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\b(the|a|an|of|in|and|to|for|vs|versus)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Drops suggestions that duplicate an existing subtopic or an earlier
 * suggestion in the same batch. The model is asked not to repeat itself, but
 * "Load balancing" and "Load Balancers" both come back often enough that the
 * check has to live in code.
 */
export function dedupeSuggestions<T extends { title: string }>(existingTitles: string[], suggestions: T[]): T[] {
  const seen = new Set(existingTitles.map(normalizeTitle));
  const out: T[] = [];
  for (const s of suggestions) {
    const key = normalizeTitle(s.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}
