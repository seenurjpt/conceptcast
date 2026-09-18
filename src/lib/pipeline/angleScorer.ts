/**
 * Deterministic angle ranking (no LLM). Same input, same output, always.
 *
 *   +3  concreteEvidence contains a number or a named tool
 *   +2  archetype not used in the user's last 4 posts
 *   +2  claim is falsifiable (a negation, a comparison, or "not")
 *   -5  requiresAuthorInput and no evidence supplied
 *   -3  token-Jaccard overlap > 0.5 with any recent claim
 */
import { isConcrete } from './evidence';

export interface ScorableAngle {
  claim: string;
  archetypeSlug: string;
  concreteEvidence: string[];
  requiresAuthorInput: boolean;
}

export interface ScoredAngle<A extends ScorableAngle = ScorableAngle> {
  angle: A;
  score: number;
  reasons: string[];
  /** Position in the input array, for stable tie-breaking. */
  index: number;
}

/** Threshold below which the run stops and asks the author for input. */
export const MIN_VIABLE_SCORE = 3;

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'it', 'for', 'on', 'that', 'this', 'with', 'as', 'your', 'you']);

export function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );
}

export function jaccard(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

const FALSIFIABLE_RE =
  /\b(not|no|never|isn't|aren't|doesn't|don't|won't|can't|cannot|wrong|instead of|rather than|worse|better|faster|slower|more|less|fewer|than|over|versus|vs\.?|beats|loses to)\b/i;

export function isFalsifiable(claim: string): boolean {
  return FALSIFIABLE_RE.test(claim);
}

export function scoreAngle(
  angle: ScorableAngle,
  ctx: { recentArchetypes: string[]; recentClaims: string[] },
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (angle.concreteEvidence.some(isConcrete)) {
    score += 3;
    reasons.push('+3 concrete evidence (number or named tool)');
  }
  if (!ctx.recentArchetypes.slice(0, 4).includes(angle.archetypeSlug)) {
    score += 2;
    reasons.push('+2 archetype not used in last 4 posts');
  }
  if (isFalsifiable(angle.claim)) {
    score += 2;
    reasons.push('+2 falsifiable claim');
  }
  if (angle.requiresAuthorInput && angle.concreteEvidence.filter((e) => e.trim()).length === 0) {
    score -= 5;
    reasons.push('-5 needs author input and has no evidence');
  }
  const overlap = ctx.recentClaims.find((c) => jaccard(c, angle.claim) > 0.5);
  if (overlap) {
    score -= 3;
    reasons.push(`-3 repeats a recent claim: "${overlap.slice(0, 60)}"`);
  }
  return { score, reasons };
}

/** Sorted best-first; ties keep input order so the result is deterministic. */
export function rankAngles<A extends ScorableAngle>(
  angles: A[],
  ctx: { recentArchetypes: string[]; recentClaims: string[] },
): ScoredAngle<A>[] {
  return angles
    .map((angle, index) => ({ angle, index, ...scoreAngle(angle, ctx) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
}
