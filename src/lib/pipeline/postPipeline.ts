/**
 * The 4-stage post pipeline, written against two small interfaces so the
 * Inngest function can supply real steps + Mongo and the tests can supply a
 * recording step runner + an in-memory store.
 *
 *   extract-angles → (verify-anchors) → write-draft → critique
 *                                        ↑ once more on a critic fail ↵
 *
 * Every stage is one `step.run`, so an Inngest retry never re-bills an
 * earlier LLM call, and every stage result is persisted on the run doc.
 */
import type { LlmComplete } from '../llm/client';
import { assemble } from '../linkedin/assemble';
import { runRules } from '../critic/rules';
import { extractAnglesPrompt, ExtractAnglesOutput, type CandidateAngle } from '../prompts/extractAngles';
import { verifyAnchorsPrompt, VerifyAnchorsOutput } from '../prompts/verifyAnchors';
import { writeDraftPrompt, WriteDraftOutput } from '../prompts/writeDraft';
import { critiquePrompt, CritiqueOutput } from '../prompts/critique';
import { rankAngles, MIN_VIABLE_SCORE } from './angleScorer';
import { allConcrete } from './evidence';
import {
  FALLBACK_ARCHETYPE,
  type ArchetypeDoc,
  type ArchetypeSlug,
  type Critique,
  type DraftSectionsShape,
  type Failure,
  type RunStatus,
  type VoiceProfileFields,
} from '../schemas/post';

/* ── interfaces the pipeline is written against ───────────────────────────── */

export interface StepRunner {
  run<T>(name: string, fn: () => Promise<T>): Promise<T>;
}

export interface TopicInput {
  id: string;
  title: string;
  content: string;
  tags: string[];
  /** Titles of every DAG ancestor: what the audience is assumed to know. */
  ancestorTitles: string[];
}

export interface StoredAngle extends CandidateAngle {
  id: string;
  score: number;
  chosen: boolean;
  verifiedAnchors?: string[];
}

export interface StoredDraftInput {
  runId: string;
  userId: string;
  topicId: string;
  angleId: string | null;
  archetypeSlug: ArchetypeSlug | null;
  sections: DraftSectionsShape;
  hashtags: string[];
  assembled: string;
  charCount: number;
  critique: Critique | null;
  revision: number;
  status: 'generating' | 'needs_author_input' | 'ready' | 'failed';
}

export interface PipelineStore {
  getTopic(topicId: string): Promise<TopicInput | null>;
  recentClaims(userId: string, limit: number): Promise<string[]>;
  recentArchetypes(userId: string, limit: number): Promise<string[]>;
  insertAngles(runId: string, topicId: string, angles: Omit<StoredAngle, 'id'>[]): Promise<StoredAngle[]>;
  getAngle(id: string): Promise<StoredAngle | null>;
  updateAngle(id: string, patch: Partial<Omit<StoredAngle, 'id'>>): Promise<void>;
  activeVoiceProfile(userId: string): Promise<VoiceProfileFields | null>;
  getArchetype(slug: string): Promise<Pick<ArchetypeDoc, 'slug' | 'name' | 'structure' | 'requiresFirsthandEvidence'> | null>;
  exemplarsFor(slug: string): Promise<string[]>;
  insertDraft(draft: StoredDraftInput): Promise<string>;
  getDraft(id: string): Promise<DraftForCritique | null>;
  updateDraft(id: string, patch: Partial<Omit<StoredDraftInput, 'runId' | 'userId' | 'topicId'>>): Promise<void>;
  updateRun(
    runId: string,
    patch: { status?: RunStatus; currentStage?: string | null; error?: string | null; finishedAt?: Date | null },
    stageResult?: { stage: string; result: unknown },
  ): Promise<void>;
}

export interface PipelineDeps {
  step: StepRunner;
  llm: LlmComplete;
  store: PipelineStore;
}

export interface PipelineInput {
  runId: string;
  userId: string;
  topicId: string;
}

export type PipelineOutcome =
  | { status: 'needs_author_input'; draftId: string; angleId: string; topScore: number }
  | { status: 'ready'; draftId: string; angleId: string; revision: number; pass: boolean };

/** Errors that retrying will not fix; the Inngest wrapper maps these to NonRetriableError. */
export class PipelineError extends Error {
  constructor(
    message: string,
    public readonly retriable = false,
  ) {
    super(message);
    this.name = 'PipelineError';
  }
}

export const MIN_EXEMPLARS = 3;

/* ── helpers ──────────────────────────────────────────────────────────────── */

/** mulberry32 seeded from a string hash: same runId, same exemplar sample. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleSeeded<T>(items: T[], n: number, seed: string): T[] {
  const rand = seededRandom(seed);
  const pool = [...items];
  const out: T[] = [];
  while (out.length < n && pool.length > 0) {
    const i = Math.floor(rand() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

const EMPTY_SECTIONS: DraftSectionsShape = { hook: '', rehook: '', context: '', body: '', takeaway: '', cta: '' };

/* ── the pipeline ─────────────────────────────────────────────────────────── */

export async function runPostPipeline(input: PipelineInput, deps: PipelineDeps): Promise<PipelineOutcome> {
  const { step, llm, store } = deps;
  const { runId, userId, topicId } = input;

  const stage = async (name: string) => store.updateRun(runId, { status: 'running', currentStage: name });

  const failRun = async (message: string): Promise<never> => {
    await store.updateRun(runId, { status: 'failed', error: message, finishedAt: new Date() });
    throw new PipelineError(message);
  };

  /* step 1: extract-angles (cheap) ------------------------------------------ */
  const extracted = await step.run('extract-angles', async () => {
    await stage('extract-angles');
    const topic = await store.getTopic(topicId);
    if (!topic) return failRun(`Topic ${topicId} not found.`);
    const [recentClaims, recentArchetypes] = await Promise.all([
      store.recentClaims(userId, 10),
      store.recentArchetypes(userId, 4),
    ]);
    const prompt = extractAnglesPrompt({
      title: topic.title,
      content: topic.content,
      tags: topic.tags,
      ancestorTitles: topic.ancestorTitles,
      recentClaims,
    });
    const out = await llm({ userId, tier: 'cheap', runId, stage: 'extract-angles', schema: ExtractAnglesOutput, ...prompt });
    const ranked = rankAngles(out.angles, { recentArchetypes, recentClaims });
    const stored = await store.insertAngles(
      runId,
      topicId,
      ranked.map((r, i) => ({ ...r.angle, score: r.score, chosen: i === 0 })),
    );
    const top = stored[0];
    const result = {
      angleId: top.id,
      archetypeSlug: top.archetypeSlug,
      topScore: top.score,
      scores: ranked.map((r) => ({ claim: r.angle.claim, score: r.score, reasons: r.reasons })),
      skipVerify: allConcrete(top.concreteEvidence),
    };
    await store.updateRun(runId, {}, { stage: 'extract-angles', result });
    return result;
  });

  if (extracted.topScore < MIN_VIABLE_SCORE) {
    return step.run('needs-author-input', async () => {
      const draftId = await store.insertDraft({
        runId,
        userId,
        topicId,
        angleId: extracted.angleId,
        archetypeSlug: extracted.archetypeSlug,
        sections: EMPTY_SECTIONS,
        hashtags: [],
        assembled: '',
        charCount: 0,
        critique: null,
        revision: 0,
        status: 'needs_author_input',
      });
      await store.updateRun(
        runId,
        { status: 'needs_author_input', currentStage: null, finishedAt: new Date() },
        { stage: 'needs-author-input', result: { draftId, topScore: extracted.topScore } },
      );
      return { status: 'needs_author_input' as const, draftId, angleId: extracted.angleId, topScore: extracted.topScore };
    });
  }

  /* step 2: verify-anchors (cheap; skipped when evidence is already concrete) */
  const verified = extracted.skipVerify
    ? null
    : await step.run('verify-anchors', async () => {
        await stage('verify-anchors');
        const [angle, topic] = await Promise.all([store.getAngle(extracted.angleId), store.getTopic(topicId)]);
        if (!angle || !topic) return failRun('Angle or topic vanished before verify-anchors.');
        const prompt = verifyAnchorsPrompt({
          title: topic.title,
          content: topic.content,
          claim: angle.claim,
          concreteEvidence: angle.concreteEvidence,
        });
        const out = await llm({ userId, tier: 'cheap', runId, stage: 'verify-anchors', schema: VerifyAnchorsOutput, ...prompt });
        // Never let the model invent an anchor: keep only items that were in the original evidence.
        const original = new Set(angle.concreteEvidence.map((e) => e.trim()));
        const unverifiable = new Set(out.unverifiableClaims.map((e) => e.trim()));
        const verifiedAnchors = out.verifiedAnchors.map((e) => e.trim()).filter((e) => original.has(e) && !unverifiable.has(e));
        let archetypeSlug = angle.archetypeSlug;
        if (verifiedAnchors.length === 0 && archetypeSlug !== FALLBACK_ARCHETYPE) archetypeSlug = FALLBACK_ARCHETYPE;
        await store.updateAngle(angle.id, {
          verifiedAnchors,
          unverifiableClaims: [...unverifiable],
          concreteEvidence: verifiedAnchors,
          archetypeSlug,
        } as Partial<StoredAngle>);
        const result = { verifiedAnchors, unverifiableClaims: [...unverifiable], archetypeSlug, downgraded: archetypeSlug !== angle.archetypeSlug };
        await store.updateRun(runId, {}, { stage: 'verify-anchors', result });
        return result;
      });

  /* step 3: write-draft (standard) ------------------------------------------ */
  const writeDraft = async (stepName: string, existingDraftId: string | null, revisionNotes: Failure[] | undefined) =>
    step.run(stepName, async () => {
      await stage(stepName);
      const angle = await store.getAngle(extracted.angleId);
      if (!angle) return failRun('Angle vanished before write-draft.');
      const profile = await store.activeVoiceProfile(userId);
      if (!profile) return failRun('No active voice profile. Add at least 10 voice samples and run voice extraction first.');
      const archetype = await store.getArchetype(angle.archetypeSlug);
      if (!archetype) return failRun(`Archetype "${angle.archetypeSlug}" is not seeded. Run scripts/seed-archetypes.ts.`);
      const pool = await store.exemplarsFor(archetype.slug);
      if (pool.length < MIN_EXEMPLARS) {
        return failRun(
          `Archetype "${archetype.slug}" has ${pool.length} exemplar(s); the writer needs at least ${MIN_EXEMPLARS}. Add them at /admin/exemplars.`,
        );
      }
      const verifiedAnchors = angle.verifiedAnchors ?? angle.concreteEvidence;
      const prompt = writeDraftPrompt({
        profile,
        exemplars: sampleSeeded(pool, MIN_EXEMPLARS, runId),
        archetype,
        claim: angle.claim,
        whoDisagrees: angle.whoDisagrees,
        verifiedAnchors,
        revisionNotes,
      });
      const out = await llm({ userId, tier: 'standard', runId, stage: stepName, schema: WriteDraftOutput, ...prompt });
      const { hashtags, ...sections } = out;
      const { assembled, charCount } = assemble(sections, hashtags);
      const revision = existingDraftId ? 1 : 0;
      let draftId = existingDraftId;
      if (draftId) {
        await store.updateDraft(draftId, { sections, hashtags, assembled, charCount, revision, critique: null, status: 'generating' });
      } else {
        draftId = await store.insertDraft({
          runId,
          userId,
          topicId,
          angleId: angle.id,
          archetypeSlug: angle.archetypeSlug,
          sections,
          hashtags,
          assembled,
          charCount,
          critique: null,
          revision,
          status: 'generating',
        });
      }
      const result = { draftId, charCount, revision };
      await store.updateRun(runId, {}, { stage: stepName, result });
      return result;
    });

  /* step 4: critique (rules first, then one cheap LLM call) ----------------- */
  const critique = async (stepName: string, draftId: string) =>
    step.run(stepName, async () => {
      await stage(stepName);
      const angle = await store.getAngle(extracted.angleId);
      const profile = await store.activeVoiceProfile(userId);
      if (!angle || !profile) return failRun('Angle or voice profile vanished before critique.');
      const draft = await loadDraftSections(store, draftId);
      const failures = runRules({
        sections: draft.sections,
        hashtags: draft.hashtags,
        assembled: draft.assembled,
        charCount: draft.charCount,
        concreteEvidence: angle.verifiedAnchors ?? angle.concreteEvidence,
      });
      const judged = await llm({
        userId,
        tier: 'cheap',
        runId,
        stage: stepName,
        schema: CritiqueOutput,
        ...critiquePrompt({ profile, assembled: draft.assembled }),
      });
      if (!judged.singleIdea) failures.push({ rule: 'single_idea', detail: 'post teaches more than one thing', severity: 'error' });
      if (judged.voiceMatch < 3) {
        failures.push({ rule: 'voice_match', detail: `voice match ${judged.voiceMatch}/5; reads as generic`, severity: 'error' });
      }
      if (!judged.hookEarnsTheClick) {
        failures.push({ rule: 'hook_earns_click', detail: 'first line leaves no open loop', severity: 'error' });
      }
      const result: Critique = { pass: failures.length === 0, failures, notes: judged.notes, voiceMatch: judged.voiceMatch };
      await store.updateDraft(draftId, { critique: result });
      await store.updateRun(runId, {}, { stage: stepName, result });
      return result;
    });

  const first = await writeDraft('write-draft', null, undefined);
  let verdict = await critique('critique', first.draftId);
  let revision = 0;
  void verified;

  if (!verdict.pass) {
    const second = await writeDraft('write-draft-revision', first.draftId, verdict.failures);
    revision = second.revision;
    verdict = await critique('critique-revision', first.draftId);
  }

  return step.run('finalize', async () => {
    await store.updateDraft(first.draftId, { status: 'ready' });
    await store.updateRun(runId, { status: 'ready', currentStage: null, finishedAt: new Date() }, {
      stage: 'finalize',
      result: { draftId: first.draftId, revision, pass: verdict.pass },
    });
    return { status: 'ready' as const, draftId: first.draftId, angleId: extracted.angleId, revision, pass: verdict.pass };
  });
}

/** What the critique stage reads back from a stored draft. */
export interface DraftForCritique {
  sections: DraftSectionsShape;
  hashtags: string[];
  assembled: string;
  charCount: number;
}

async function loadDraftSections(store: PipelineStore, draftId: string): Promise<DraftForCritique> {
  const d = await store.getDraft(draftId);
  if (!d) throw new PipelineError(`Draft ${draftId} vanished before critique.`);
  return d;
}
