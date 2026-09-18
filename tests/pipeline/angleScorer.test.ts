import { describe, expect, it } from 'vitest';
import { isFalsifiable, jaccard, rankAngles, scoreAngle, MIN_VIABLE_SCORE } from '@/lib/pipeline/angleScorer';
import { allConcrete, isConcrete } from '@/lib/pipeline/evidence';

const base = { whoDisagrees: 'someone', requiresAuthorInput: false };

describe('evidence concreteness', () => {
  it('numbers and named tools are concrete', () => {
    expect(isConcrete('p99 dropped to 120ms')).toBe(true);
    expect(isConcrete('pgvector ivfflat index')).toBe(true);
    expect(isConcrete('Next.js middleware runs on the edge')).toBe(true);
    expect(isConcrete('it feels slower under load')).toBe(false);
    expect(allConcrete([])).toBe(false);
    expect(allConcrete(['pgvector', 'vague feeling'])).toBe(false);
    expect(allConcrete(['pgvector', '3 retries'])).toBe(true);
  });
});

describe('scoreAngle', () => {
  const ctx = { recentArchetypes: [], recentClaims: [] };

  it('+3 for concrete evidence', () => {
    const a = { ...base, claim: 'Chunking matters', archetypeSlug: 'concept-unpack', concreteEvidence: ['pgvector'] };
    const b = { ...a, concreteEvidence: ['it depends'] };
    expect(scoreAngle(a, ctx).score - scoreAngle(b, ctx).score).toBe(3);
  });

  it('+2 when the archetype was not used in the last 4 posts', () => {
    const a = { ...base, claim: 'Chunking matters', archetypeSlug: 'build-log', concreteEvidence: ['x'] };
    expect(scoreAngle(a, { ...ctx, recentArchetypes: ['build-log'] }).score).toBe(0);
    expect(scoreAngle(a, { ...ctx, recentArchetypes: ['post-mortem', 'depth-ladder', 'concept-unpack', 'myth-vs-reality', 'build-log'] }).score).toBe(2);
    expect(scoreAngle(a, ctx).score).toBe(2);
  });

  it('+2 for a falsifiable claim', () => {
    expect(isFalsifiable('Fixed-size chunking is not the problem')).toBe(true);
    expect(isFalsifiable('Semantic chunking beats fixed-size for support docs')).toBe(true);
    expect(isFalsifiable('Chunking, an overview')).toBe(false);
    const a = { ...base, claim: 'Chunking is worse than headings', archetypeSlug: 'build-log', concreteEvidence: ['x'] };
    expect(scoreAngle(a, { ...ctx, recentArchetypes: ['build-log'] }).score).toBe(2);
  });

  it('-5 when author input is required and no evidence is supplied', () => {
    const a = { ...base, claim: 'Chunking is worse', archetypeSlug: 'build-log', concreteEvidence: [' '], requiresAuthorInput: true };
    expect(scoreAngle(a, { ...ctx, recentArchetypes: ['build-log'] }).score).toBe(2 - 5);
    const withEvidence = { ...a, concreteEvidence: ['pgvector'] };
    expect(scoreAngle(withEvidence, { ...ctx, recentArchetypes: ['build-log'] }).score).toBe(3 + 2);
  });

  it('-3 repetition penalty on token Jaccard > 0.5', () => {
    const claim = 'Fixed-size chunking is why your retrieval is bad';
    expect(jaccard(claim, claim)).toBe(1);
    expect(jaccard(claim, 'Fixed-size chunking is why retrieval is bad')).toBeGreaterThan(0.5);
    expect(jaccard(claim, 'Prompt caching pays for itself on the second call')).toBeLessThan(0.5);
    const a = { ...base, claim, archetypeSlug: 'build-log', concreteEvidence: ['pgvector'] };
    const fresh = scoreAngle(a, ctx).score;
    const repeated = scoreAngle(a, { ...ctx, recentClaims: ['Fixed-size chunking is why retrieval is bad'] }).score;
    expect(fresh - repeated).toBe(3);
    expect(scoreAngle(a, { ...ctx, recentClaims: ['Prompt caching pays for itself on the second call'] }).score).toBe(fresh);
  });
});

describe('rankAngles', () => {
  const angles = [
    { ...base, claim: 'A subject, not a claim', archetypeSlug: 'concept-unpack', concreteEvidence: ['vibes'] },
    { ...base, claim: 'pgvector is slower than you think past 1M rows', archetypeSlug: 'post-mortem', concreteEvidence: ['pgvector', '1M rows'] },
    { ...base, claim: 'Chunking beats embeddings for recall', archetypeSlug: 'build-log', concreteEvidence: ['none really'] },
    { ...base, claim: 'Tie candidate one', archetypeSlug: 'depth-ladder', concreteEvidence: ['x'] },
    { ...base, claim: 'Tie candidate two', archetypeSlug: 'depth-ladder', concreteEvidence: ['x'] },
    { ...base, claim: 'Needs a war story', archetypeSlug: 'myth-vs-reality', concreteEvidence: [''], requiresAuthorInput: true },
  ];
  const ctx = { recentArchetypes: ['concept-unpack'], recentClaims: ['Tie candidate one'] };

  it('is deterministic: same input, same order, ties keep input order', () => {
    const r1 = rankAngles(angles, ctx);
    const r2 = rankAngles([...angles], { ...ctx });
    expect(r1.map((r) => r.angle.claim)).toEqual(r2.map((r) => r.angle.claim));
    expect(r1[0].angle.claim).toBe('pgvector is slower than you think past 1M rows');
    expect(r1[0].score).toBe(3 + 2 + 2);
    expect(r1[r1.length - 1].angle.claim).toBe('Needs a war story');
    // Same-score angles keep their input order.
    const tieIdx = r1.findIndex((r) => r.angle.claim === 'Tie candidate two');
    const penalisedIdx = r1.findIndex((r) => r.angle.claim === 'Tie candidate one');
    expect(tieIdx).toBeLessThan(penalisedIdx);
  });

  it('exposes the needs-author-input threshold', () => {
    expect(MIN_VIABLE_SCORE).toBe(3);
  });
});
