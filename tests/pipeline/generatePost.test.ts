/**
 * Inngest generate-post flow, with lib/llm/client mocked and an in-memory
 * PipelineStore. A recording StepRunner stands in for Inngest's `step`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('@/lib/llm/client', () => ({
  complete: vi.fn(),
  StructuredOutputError: class extends Error {},
}));

import { complete } from '@/lib/llm/client';
import { runPostPipeline, PipelineError, type PipelineStore, type StepRunner, type StoredAngle, type StoredDraftInput } from '@/lib/pipeline/postPipeline';
import { assemble } from '@/lib/linkedin/assemble';
import type { VoiceProfileFields, Critique, RunStatus } from '@/lib/schemas/post';

/* ── fixtures ─────────────────────────────────────────────────────────────── */

const profile: VoiceProfileFields = {
  sentenceRhythm: 'short',
  openingMoves: ['a number first'],
  hedgingVocabulary: 'none',
  recurringReferences: ['pgvector'],
  humorRegister: 'dry',
  bannedWords: ['synergy'],
  handlesUncertainty: 'says so',
  rawNotes: '',
};

const filler = (n: number) =>
  Array.from({ length: n }, (_, i) => `Sentence ${i + 1} adds one more concrete detail to the argument.`).join('\n');

const goodDraft = {
  hook: 'Fixed-size chunking is why your retrieval is bad, and everyone blames the embedding model.',
  rehook: 'I spent a week tuning embeddings before I looked at the chunker.',
  context: 'We index support PDFs into pgvector for a support bot. Retrieval was mediocre.',
  body: filler(18) + '\n→ recall went up once the chunks followed headings\n→ the embedding model never changed',
  takeaway: 'Look at your chunk boundaries before you touch the model.',
  cta: 'What chunking strategy did you end up with, and what broke first?',
  hashtags: ['Rag', 'Chunking', 'LLM'],
};

const goodCritique = { singleIdea: true, voiceMatch: 4, hookEarnsTheClick: true, notes: [] };

function angleSet(top: { claim: string; evidence: string[]; requiresAuthorInput?: boolean; archetypeSlug?: string }) {
  const rest = Array.from({ length: 5 }, (_, i) => ({
    claim: `Weak subject ${i}`,
    archetypeSlug: 'concept-unpack',
    whoDisagrees: 'nobody',
    concreteEvidence: ['vibes'],
    requiresAuthorInput: true,
  }));
  return {
    angles: [
      {
        claim: top.claim,
        archetypeSlug: top.archetypeSlug ?? 'build-log',
        whoDisagrees: 'the embedding vendors',
        concreteEvidence: top.evidence,
        requiresAuthorInput: top.requiresAuthorInput ?? false,
      },
      ...rest,
    ],
  };
}

/* ── in-memory store + recording step runner ──────────────────────────────── */

interface MemDraft extends StoredDraftInput {
  id: string;
}

function memStore(opts: { exemplars?: number; profile?: VoiceProfileFields | null } = {}) {
  let seq = 0;
  const angles = new Map<string, StoredAngle>();
  const drafts = new Map<string, MemDraft>();
  const runs: { patch: { status?: RunStatus; currentStage?: string | null; error?: string | null }; stage?: string }[] = [];
  const exemplarCount = opts.exemplars ?? 3;
  const store: PipelineStore & { angles: typeof angles; drafts: typeof drafts; runs: typeof runs } = {
    angles,
    drafts,
    runs,
    async getTopic(id) {
      return { id, title: 'Chunking', content: 'Notes about chunking and pgvector.', tags: ['rag'], ancestorTitles: ['Embeddings'] };
    },
    async recentClaims() {
      return ['Prompt caching pays for itself on the second call'];
    },
    async recentArchetypes() {
      return ['concept-unpack'];
    },
    async insertAngles(_runId, _topicId, list) {
      return list.map((a) => {
        const id = `angle-${++seq}`;
        const stored = { ...a, id };
        angles.set(id, stored);
        return stored;
      });
    },
    async getAngle(id) {
      return angles.get(id) ?? null;
    },
    async updateAngle(id, patch) {
      angles.set(id, { ...(angles.get(id) as StoredAngle), ...patch });
    },
    async activeVoiceProfile() {
      return opts.profile === undefined ? profile : opts.profile;
    },
    async getArchetype(slug) {
      return { slug: slug as 'build-log', name: slug, structure: [{ slot: 'hook', guidance: 'g' }], requiresFirsthandEvidence: slug !== 'concept-unpack' };
    },
    async exemplarsFor() {
      return Array.from({ length: exemplarCount }, (_, i) => `exemplar ${i}`);
    },
    async insertDraft(d) {
      const id = `draft-${++seq}`;
      drafts.set(id, { ...d, id });
      return id;
    },
    async getDraft(id) {
      const d = drafts.get(id);
      return d ? { sections: d.sections, hashtags: d.hashtags, assembled: d.assembled, charCount: d.charCount } : null;
    },
    async updateDraft(id, patch) {
      drafts.set(id, { ...(drafts.get(id) as MemDraft), ...patch } as MemDraft);
    },
    async updateRun(_runId, patch, stageResult) {
      runs.push({ patch, stage: stageResult?.stage });
    },
  };
  return store;
}

function recordingStep(): StepRunner & { names: string[] } {
  const names: string[] = [];
  return {
    names,
    async run(name, fn) {
      names.push(name);
      return fn();
    },
  };
}

const mockedComplete = vi.mocked(complete);

/** Route each mocked LLM call by its `stage` so tests read like a script. */
function scriptLlm(script: Record<string, unknown | ((args: { stage?: string; messages: { content: string }[] }) => unknown)>) {
  mockedComplete.mockImplementation(async (args) => {
    const key = args.stage ?? 'unknown';
    const entry = script[key];
    if (entry === undefined) throw new Error(`no scripted response for stage ${key}`);
    const value = typeof entry === 'function' ? (entry as (a: typeof args) => unknown)(args) : entry;
    if (args.schema) (args.schema as z.ZodType).parse(value);
    return value as never;
  });
}

const input = { runId: 'run-1', userId: 'u1', topicId: 't1' };

beforeEach(() => {
  mockedComplete.mockReset();
});

/* ── tests ────────────────────────────────────────────────────────────────── */

describe('generate-post pipeline', () => {
  it('runs stages in order, skipping verify-anchors when evidence is already concrete', async () => {
    scriptLlm({
      'extract-angles': angleSet({ claim: 'pgvector is slower than you think past 1M rows', evidence: ['pgvector', '1M rows'] }),
      'write-draft': goodDraft,
      critique: goodCritique,
    });
    const step = recordingStep();
    const store = memStore();
    const out = await runPostPipeline(input, { step, llm: complete, store });

    expect(step.names).toEqual(['extract-angles', 'write-draft', 'critique', 'finalize']);
    expect(mockedComplete.mock.calls.map((c) => c[0].stage)).toEqual(['extract-angles', 'write-draft', 'critique']);
    expect(mockedComplete.mock.calls.map((c) => c[0].tier)).toEqual(['cheap', 'standard', 'cheap']);
    expect(out.status).toBe('ready');
    const draft = store.drafts.get((out as { draftId: string }).draftId);
    expect(draft?.status).toBe('ready');
    expect(draft?.revision).toBe(0);
    expect(draft?.critique?.pass).toBe(true);
    expect(draft?.assembled).toBe(assemble(goodDraft, goodDraft.hashtags).assembled);
    expect(store.runs.at(-1)?.patch.status).toBe('ready');
    // All 6 angles persisted, exactly one chosen, and it is the top scorer.
    const chosen = [...store.angles.values()].filter((a) => a.chosen);
    expect(store.angles.size).toBe(6);
    expect(chosen).toHaveLength(1);
    expect(chosen[0].claim).toContain('pgvector');
  });

  it('runs verify-anchors when evidence is not concrete and strips unverifiable claims', async () => {
    scriptLlm({
      'extract-angles': angleSet({
        claim: 'Semantic chunking beats fixed-size for support docs',
        evidence: ['pgvector', 'recall improved a lot', 'latency dropped 40%'],
      }),
      'verify-anchors': { verifiedAnchors: ['pgvector', 'invented-by-model'], unverifiableClaims: ['latency dropped 40%', 'recall improved a lot'] },
      'write-draft': (args: { messages: { content: string }[] }) => {
        const user = args.messages[0].content;
        expect(user).toContain('<verified_anchors>\npgvector\n</verified_anchors>');
        expect(user).not.toContain('invented-by-model');
        expect(user).not.toContain('40%');
        return goodDraft;
      },
      critique: goodCritique,
    });
    const step = recordingStep();
    const store = memStore();
    await runPostPipeline(input, { step, llm: complete, store });

    expect(step.names).toEqual(['extract-angles', 'verify-anchors', 'write-draft', 'critique', 'finalize']);
    const angle = [...store.angles.values()].find((a) => a.chosen) as StoredAngle;
    expect(angle.verifiedAnchors).toEqual(['pgvector']);
    expect(angle.archetypeSlug).toBe('build-log');
  });

  it('downgrades to concept-unpack when nothing survives verification', async () => {
    scriptLlm({
      'extract-angles': angleSet({ claim: 'Chunking beats embeddings for recall', evidence: ['recall improved a lot'] }),
      'verify-anchors': { verifiedAnchors: [], unverifiableClaims: ['recall improved a lot'] },
      'write-draft': goodDraft,
      critique: goodCritique,
    });
    const store = memStore();
    await runPostPipeline(input, { step: recordingStep(), llm: complete, store });
    const angle = [...store.angles.values()].find((a) => a.chosen) as StoredAngle;
    expect(angle.archetypeSlug).toBe('concept-unpack');
    expect(angle.verifiedAnchors).toEqual([]);
  });

  it('retries write-draft exactly once when the critic fails, then marks ready with the critique attached', async () => {
    let writes = 0;
    let critiques = 0;
    scriptLlm({
      'extract-angles': angleSet({ claim: 'pgvector is slower than you think past 1M rows', evidence: ['pgvector', '1M rows'] }),
      'write-draft': () => {
        writes++;
        return { ...goodDraft, cta: 'Follow me for more.' }; // deterministic fail: cta_not_bait
      },
      'write-draft-revision': (args: { messages: { content: string }[] }) => {
        writes++;
        expect(args.messages[0].content).toContain('<revision_notes>');
        expect(args.messages[0].content).toContain('cta_not_bait');
        return { ...goodDraft, cta: 'Still follow me for more.' }; // fails again on purpose
      },
      critique: () => {
        critiques++;
        return { ...goodCritique, hookEarnsTheClick: false };
      },
      'critique-revision': () => {
        critiques++;
        return goodCritique;
      },
    });
    const step = recordingStep();
    const store = memStore();
    const out = await runPostPipeline(input, { step, llm: complete, store });

    expect(step.names).toEqual(['extract-angles', 'write-draft', 'critique', 'write-draft-revision', 'critique-revision', 'finalize']);
    expect(writes).toBe(2);
    expect(critiques).toBe(2);
    expect(out.status).toBe('ready');
    expect(store.drafts.size).toBe(1);
    const draft = [...store.drafts.values()][0];
    expect(draft.status).toBe('ready');
    expect(draft.revision).toBe(1);
    const critique = draft.critique as Critique;
    expect(critique.pass).toBe(false);
    expect(critique.failures.map((f) => f.rule)).toEqual(['cta_not_bait']);
  });

  it('short-circuits to needs_author_input when the top angle scores below 3', async () => {
    scriptLlm({
      'extract-angles': angleSet({
        claim: 'Chunking, an overview',
        evidence: ['vibes'],
        archetypeSlug: 'concept-unpack',
        requiresAuthorInput: true,
      }),
    });
    const step = recordingStep();
    const store = memStore();
    const out = await runPostPipeline(input, { step, llm: complete, store });

    expect(out.status).toBe('needs_author_input');
    expect(step.names).toEqual(['extract-angles', 'needs-author-input']);
    expect(mockedComplete).toHaveBeenCalledTimes(1);
    const draft = store.drafts.get((out as { draftId: string }).draftId);
    expect(draft?.status).toBe('needs_author_input');
    expect(draft?.assembled).toBe('');
    expect(store.runs.at(-1)?.patch.status).toBe('needs_author_input');
  });

  it('refuses to write when the archetype has fewer than 3 exemplars and records the reason on the run', async () => {
    scriptLlm({
      'extract-angles': angleSet({ claim: 'pgvector is slower than you think past 1M rows', evidence: ['pgvector', '1M rows'] }),
    });
    const store = memStore({ exemplars: 2 });
    await expect(runPostPipeline(input, { step: recordingStep(), llm: complete, store })).rejects.toThrow(PipelineError);
    const last = store.runs.at(-1);
    expect(last?.patch.status).toBe('failed');
    expect(last?.patch.error).toMatch(/"build-log" has 2 exemplar/);
    expect(mockedComplete.mock.calls.map((c) => c[0].stage)).toEqual(['extract-angles']);
  });

  it('fails clearly without an active voice profile', async () => {
    scriptLlm({
      'extract-angles': angleSet({ claim: 'pgvector is slower than you think past 1M rows', evidence: ['pgvector', '1M rows'] }),
    });
    const store = memStore({ profile: null });
    await expect(runPostPipeline(input, { step: recordingStep(), llm: complete, store })).rejects.toThrow(/voice profile/);
  });
});
