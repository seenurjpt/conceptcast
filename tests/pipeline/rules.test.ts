import { describe, expect, it } from 'vitest';
import { RULES, runRules, type CritiqueInput } from '@/lib/critic/rules';
import { assemble } from '@/lib/linkedin/assemble';

const filler = (n: number) =>
  Array.from({ length: n }, (_, i) => `Sentence ${i + 1} adds one more concrete detail to the argument.`).join('\n');

function good(overrides: Partial<CritiqueInput['sections']> = {}, hashtags = ['Rag', 'Chunking', 'LLM']): CritiqueInput {
  const sections = {
    hook: 'Fixed-size chunking is why your retrieval is bad, and everyone blames the embedding model.',
    rehook: 'I spent a week tuning embeddings before I looked at the chunker.',
    context: 'We index 40k GB of PDFs into pgvector for a support bot. Retrieval was mediocre.',
    body: filler(18) + '\n→ recall went up once the chunks followed headings\n→ the embedding model never changed',
    takeaway: 'Look at your chunk boundaries before you touch the model.',
    cta: 'What chunking strategy did you end up with, and what broke first?',
    ...overrides,
  };
  const { assembled, charCount } = assemble(sections, hashtags);
  return { sections, hashtags, assembled, charCount, concreteEvidence: ['40k GB of PDFs', 'pgvector'] };
}

describe('deterministic critic rules', () => {
  it('a well-formed post passes every rule', () => {
    const input = good();
    expect(input.charCount).toBeGreaterThanOrEqual(1400);
    expect(input.charCount).toBeLessThanOrEqual(2200);
    expect(runRules(input)).toEqual([]);
  });

  it('hook_length', () => {
    expect(RULES.hook_length(good())).toBeNull();
    const f = RULES.hook_length(good({ hook: 'x'.repeat(141) }));
    expect(f?.rule).toBe('hook_length');
    // 70 astral emoji = 140 units passes; 71 fails.
    expect(RULES.hook_length(good({ hook: '🚀'.repeat(70) }))).toBeNull();
    expect(RULES.hook_length(good({ hook: '🚀'.repeat(71) }))?.rule).toBe('hook_length');
  });

  it('hook_standalone', () => {
    expect(RULES.hook_standalone(good())).toBeNull();
    for (const h of ['This is why it broke.', 'It failed.', 'They said no.', 'These three things.', 'that one bug']) {
      expect(RULES.hook_standalone(good({ hook: h }))?.rule).toBe('hook_standalone');
    }
    expect(RULES.hook_standalone(good({ hook: 'Thistle is a plant.' }))).toBeNull();
  });

  it('total_length', () => {
    expect(RULES.total_length(good())).toBeNull();
    expect(RULES.total_length({ ...good(), charCount: 1399 })?.rule).toBe('total_length');
    expect(RULES.total_length({ ...good(), charCount: 2201 })?.rule).toBe('total_length');
  });

  it('hard_cap', () => {
    expect(RULES.hard_cap(good())).toBeNull();
    expect(RULES.hard_cap({ ...good(), charCount: 3001 })?.rule).toBe('hard_cap');
    expect(RULES.hard_cap({ ...good(), charCount: 3000 })).toBeNull();
  });

  it('no_markdown', () => {
    expect(RULES.no_markdown(good())).toBeNull();
    expect(RULES.no_markdown(good({ body: 'Some **bold** text' }))?.rule).toBe('no_markdown');
    expect(RULES.no_markdown(good({ body: '# Heading\ntext' }))?.rule).toBe('no_markdown');
    expect(RULES.no_markdown(good({ body: 'list:\n- item' }))?.rule).toBe('no_markdown');
    expect(RULES.no_markdown(good({ body: 'see [docs](x)' }))?.rule).toBe('no_markdown');
    expect(RULES.no_markdown(good({ body: '→ arrow list is fine\n• so is a bullet' }))).toBeNull();
  });

  it('no_em_dash', () => {
    expect(RULES.no_em_dash(good())).toBeNull();
    expect(RULES.no_em_dash(good({ body: 'one — two' }))?.rule).toBe('no_em_dash');
  });

  it('banned_openers', () => {
    expect(RULES.banned_openers(good())).toBeNull();
    expect(RULES.banned_openers(good({ hook: "Let's dive in to chunking." }))?.rule).toBe('banned_openers');
    expect(RULES.banned_openers(good({ hook: 'unpopular opinion: chunking matters' }))?.rule).toBe('banned_openers');
    expect(RULES.banned_openers(good({ hook: 'Hot takes are cheap. Here is data.' }))?.rule).toBe('banned_openers');
  });

  it('banned_phrases', () => {
    expect(RULES.banned_phrases(good())).toBeNull();
    const f = RULES.banned_phrases(good({ body: 'We leverage a deep dive here.' }));
    expect(f?.rule).toBe('banned_phrases');
    expect(f?.detail).toContain('leverage');
    expect(f?.detail).toContain('deep dive');
  });

  it('no_unsourced_numbers', () => {
    expect(RULES.no_unsourced_numbers(good())).toBeNull();
    const f = RULES.no_unsourced_numbers(good({ body: 'Latency dropped 37% and p99 was 120ms.' }));
    expect(f?.rule).toBe('no_unsourced_numbers');
    expect(f?.detail).toContain('37%');
    expect(f?.detail).toContain('120ms');
    // Sourced numbers pass regardless of spacing/case.
    const sourced = { ...good({ body: 'We saw 120 ms at p99, about 2.5x better.' }), concreteEvidence: ['40k GB of PDFs', '120ms p99', '2.5X faster'] };
    expect(RULES.no_unsourced_numbers(sourced)).toBeNull();
    // "5 steps" is not a "5 s" measurement.
    expect(RULES.no_unsourced_numbers(good({ body: 'It took 5 steps.' }))).toBeNull();
  });

  it('cta_not_bait', () => {
    expect(RULES.cta_not_bait(good())).toBeNull();
    for (const cta of ['Follow me for more.', 'Follow for more tips', 'Comment "YES" below', 'Comment chunk below', 'Repost if this helped']) {
      expect(RULES.cta_not_bait(good({ cta }))?.rule).toBe('cta_not_bait');
    }
  });

  it('hashtag_format', () => {
    expect(RULES.hashtag_format(good())).toBeNull();
    expect(RULES.hashtag_format(good({}, ['a', 'b']))?.rule).toBe('hashtag_format');
    expect(RULES.hashtag_format(good({}, ['a', 'b', 'c', 'd', 'e', 'f']))?.rule).toBe('hashtag_format');
    expect(RULES.hashtag_format(good({}, ['ok', 'has space', 'fine']))?.rule).toBe('hashtag_format');
    expect(RULES.hashtag_format(good({}, ['ok', 'under_score', 'fine']))?.rule).toBe('hashtag_format');
    expect(RULES.hashtag_format(good({}, ['#Prefixed', 'PascalCase', 'v2']))).toBeNull();
  });

  it('no_links_in_body', () => {
    expect(RULES.no_links_in_body(good())).toBeNull();
    expect(RULES.no_links_in_body(good({ body: 'see https://example.com' }))?.rule).toBe('no_links_in_body');
    expect(RULES.no_links_in_body(good({ cta: 'http://x.y' }))?.rule).toBe('no_links_in_body');
  });

  it('runRules collects one failure per broken rule', () => {
    const bad = good({ hook: 'This is **bold** — https://x.y', cta: 'follow for more' }, ['a']);
    const rules = runRules(bad).map((f) => f.rule);
    expect(rules).toEqual(
      expect.arrayContaining(['hook_standalone', 'no_markdown', 'no_em_dash', 'cta_not_bait', 'hashtag_format', 'no_links_in_body']),
    );
    expect(new Set(rules).size).toBe(rules.length);
  });
});
