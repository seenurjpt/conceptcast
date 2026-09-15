import { callJson, MODELS } from '../anthropic';
import { loadPrompt } from '../loadPrompt';
import { Concept, type ConceptDoc } from '../db/models';
import { eligibleConcepts } from '../concepts/dag';
import { recentPublished, recentTracks, type RecentPost } from '../feedback';
import { SelectorOutputSchema } from '../schemas';

export interface RankedCandidate {
  slug: string;
  title: string;
  track: string;
  teachability: number;
  surprise: number;
  applicability: number;
  reasoning: string;
  timelinessBoost: number;
  devRelevance: number;
  /** Final ordering key. */
  total: number;
}

/**
 * Final score. The LLM axes carry it (surprise weighted double, spec §5.1);
 * the code adds the hand-seeded relevance and the decaying news signal so a
 * timely concept jumps the queue without the LLM having to reason about it.
 */
export function combinedScore(c: {
  teachability: number;
  surprise: number;
  applicability: number;
  devRelevance: number;
  timelinessBoost: number;
}): number {
  return c.teachability + 2 * c.surprise + c.applicability + 0.5 * c.devRelevance + 0.5 * c.timelinessBoost;
}

/** Selector — Haiku 4.5 ranks the eligible candidates (spec §5.1). */
export async function rankCandidates(
  candidates: ConceptDoc[],
  recent: RecentPost[],
): Promise<RankedCandidate[]> {
  const recentBlock = recent.length
    ? recent
        .map(
          (r) =>
            `- ${r.title} [${r.track}]` +
            (r.metrics
              ? ` — ${r.metrics.reactions} reactions, ${r.metrics.comments} comments, ${r.metrics.shares} shares`
              : ' — engagement not yet known'),
        )
        .join('\n')
    : '(nothing published yet)';

  const candidateBlock = candidates
    .map((c) =>
      JSON.stringify({
        slug: c.slug,
        title: c.title,
        oneLiner: c.oneLiner,
        track: c.track,
        difficulty: c.difficulty,
        devRelevance: c.devRelevance,
        timelinessBoost: c.timelinessBoost,
      }),
    )
    .join('\n');

  const out = await callJson({
    stage: 'selector',
    model: MODELS.light,
    system: [{ type: 'text', text: loadPrompt('selector'), cache_control: { type: 'ephemeral' } }],
    maxTokens: 4_000,
    messages: [
      {
        role: 'user',
        content:
          `# Recently published (do not repeat the same ground)\n\n${recentBlock}\n\n` +
          `# Candidates (one JSON object per line)\n\n${candidateBlock}`,
      },
    ],
    schema: SelectorOutputSchema,
  });

  const bySlug = new Map(candidates.map((c) => [c.slug, c]));
  const ranked: RankedCandidate[] = [];
  for (const r of out.rankings) {
    const c = bySlug.get(r.slug);
    if (!c) continue; // the model invented a slug; ignore it
    const row = {
      ...r,
      title: c.title,
      track: c.track,
      timelinessBoost: c.timelinessBoost,
      devRelevance: c.devRelevance,
    };
    ranked.push({ ...row, total: combinedScore(row) });
  }
  return ranked.sort((a, b) => b.total - a.total);
}

export interface SelectionResult {
  eligible: number;
  ranked: RankedCandidate[];
  chosen: ConceptDoc | null;
}

/**
 * Full selection: eligibility filter in code, Haiku ranking, pick the top.
 * Does not mutate anything — the caller marks the concept `selected`.
 */
export async function selectNextConcept(): Promise<SelectionResult> {
  const [all, published, tracks, recent] = await Promise.all([
    Concept.find({ status: 'backlog' }).lean<ConceptDoc[]>(),
    Concept.find({ status: 'published' }, { slug: 1 }).lean<Pick<ConceptDoc, 'slug'>[]>(),
    recentTracks(2),
    recentPublished(10),
  ]);
  const publishedSlugs = new Set(published.map((p) => p.slug));
  const eligible = eligibleConcepts(all, publishedSlugs, tracks);
  if (eligible.length === 0) return { eligible: 0, ranked: [], chosen: null };

  // Keep the Haiku call small: pre-trim to the ~15 most relevant by seed weight + timeliness.
  const shortlist = [...eligible]
    .sort((a, b) => b.devRelevance + b.timelinessBoost - (a.devRelevance + a.timelinessBoost))
    .slice(0, 15);

  const ranked = await rankCandidates(shortlist, recent);
  const chosen = ranked.length ? (shortlist.find((c) => c.slug === ranked[0].slug) ?? null) : null;
  return { eligible: eligible.length, ranked, chosen };
}
