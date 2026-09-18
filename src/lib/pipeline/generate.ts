/**
 * The generate-post pipeline (spec §2 boxes 2–5), shared by the CLI, the API
 * routes and the Inngest function. Two halves so Inngest can checkpoint
 * between them: `researchConcept` and `draftFromResearch`.
 */
import type { Types } from 'mongoose';
import { Concept, Research, Draft, type ConceptDoc, type ResearchDoc, type DraftDoc } from '../db/models';
import { installUsageSink, setUsageConcept } from '../db/usageSink';
import { resolveSources } from '../sources/resolve';
import { runResearcher, dropMediumConfidence } from '../agents/researcher';
import { runWriter, runReviser, pickAngles } from '../agents/writer';
import { runCritic, passes, type VariantForCritique } from '../agents/critic';
import { checkHardConstraints } from './constraints';
import { loadVoiceContext } from '../voice';
import { recentPublished } from '../feedback';
import type { Angle, Critique, Research as ResearchOutput } from '../schemas';

export type Log = (msg: string) => void;
const noop: Log = () => {};

export interface DraftRunResult {
  conceptSlug: string;
  status: 'pass' | 'dead';
  draftId: string;
  researchId: string;
  angle: Angle;
  body: string;
  score: number;
  autoFails: string[];
  issues: string[];
  constraintViolations: string[];
  revised: boolean;
  critique: Critique;
}

/** First two non-empty lines — what LinkedIn shows before the fold. */
export function extractHook(body: string): string {
  return body
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .slice(0, 2)
    .join('\n');
}

export function extractHashtags(body: string): string[] {
  return [...body.matchAll(/#[A-Za-z0-9_]+/g)].map((m) => m[0]).slice(0, 3);
}

/** Strip persistence-only fields so the stored research matches the agent contract. */
export function toResearchOutput(doc: ResearchDoc): ResearchOutput {
  return {
    mechanism: doc.mechanism,
    facts: doc.facts.map((f) => ({ text: f.text, sourceUrl: f.sourceUrl, type: f.type, confidence: f.confidence })),
    misconceptions: doc.misconceptions.map((m) => ({ belief: m.belief, reality: m.reality, sourceUrl: m.sourceUrl })),
    codeExample: doc.codeExample
      ? { language: doc.codeExample.language, snippet: doc.codeExample.snippet, explanation: doc.codeExample.explanation }
      : null,
    devImplication: doc.devImplication,
    analogyCandidates: [...doc.analogyCandidates],
  };
}

/* ── half 1: sources + research ───────────────────────────────────────────── */

export async function researchConcept(concept: ConceptDoc, log: Log = noop): Promise<ResearchDoc> {
  installUsageSink();
  setUsageConcept(concept.slug);
  try {
    log(`resolving ${concept.primarySources.length} primary source(s)`);
    const resolved = await resolveSources(concept.primarySources, (m) => log(`  ${m}`));
    if (resolved.sources.length === 0 && concept.primarySources.length > 0) {
      log('  no primary source resolved; researcher will rely on web_search');
    }

    log('researching');
    const research = await runResearcher(concept, resolved.sources);
    const kept = dropMediumConfidence(research);
    log(
      `  ${research.facts.length} facts (${kept.facts.length} high-confidence), ` +
        `${research.misconceptions.length} misconception(s), code example: ${research.codeExample ? 'yes' : 'no'}`,
    );

    const titleByUrl = new Map(concept.primarySources.map((s) => [s.url, s.title]));
    const doc = await Research.create({
      conceptId: concept._id,
      mechanism: research.mechanism,
      facts: research.facts.map((f) => ({ ...f, sourceTitle: titleByUrl.get(f.sourceUrl) ?? null })),
      misconceptions: research.misconceptions,
      codeExample: research.codeExample,
      devImplication: research.devImplication,
      analogyCandidates: research.analogyCandidates,
      resolvedSources: resolved.sources.map((s) => ({ url: s.url, chars: s.text.length, truncated: s.truncated })),
    });
    log(`  saved research ${doc._id}`);
    return doc.toObject() as ResearchDoc;
  } finally {
    setUsageConcept(null);
  }
}

/* ── half 2: write → critique → (revise) → persist ────────────────────────── */

interface DraftSaveInput {
  concept: ConceptDoc;
  researchId: Types.ObjectId;
  angle: Angle;
  body: string;
  score: number;
  autoFails: string[];
  issues: string[];
  strengths: string[];
  violations: string[];
  version: number;
  revisionOf: Types.ObjectId | null;
  status: DraftDoc['status'];
}

async function saveDraft(d: DraftSaveInput): Promise<Types.ObjectId> {
  const doc = await Draft.create({
    conceptId: d.concept._id,
    researchId: d.researchId,
    angle: d.angle,
    hook: extractHook(d.body),
    body: d.body,
    charCount: d.body.length,
    hashtags: extractHashtags(d.body),
    critique: {
      score: d.score,
      issues: [
        ...d.autoFails.map((f) => `auto-fail: ${f}`),
        ...d.violations.map((v) => `constraint: ${v}`),
        ...d.issues,
      ],
      strengths: d.strengths,
      depthPassed: d.autoFails.length === 0 && d.violations.length === 0,
      revisionOf: d.revisionOf,
    },
    version: d.version,
    status: d.status,
  });
  return doc._id;
}

export interface DraftOptions {
  /** Defaults to the track-rotated three from `pickAngles`. A single angle writes one variant. */
  angles?: Angle[];
  log?: Log;
}

export async function draftFromResearch(
  concept: ConceptDoc,
  researchDoc: ResearchDoc,
  opts: DraftOptions = {},
): Promise<DraftRunResult> {
  const log = opts.log ?? noop;
  installUsageSink();
  setUsageConcept(concept.slug);
  try {
    const research = dropMediumConfidence(toResearchOutput(researchDoc));
    const angles = opts.angles?.length ? opts.angles : pickAngles(concept);
    const [voice, recent] = await Promise.all([loadVoiceContext(), recentPublished(10)]);
    const recentHooks = recent.map((r) => r.hook).filter(Boolean);

    log(`writing ${angles.length} variant(s): ${angles.join(', ')}`);
    const written = await runWriter({ concept, research, voice, angles });
    const variants: VariantForCritique[] = written.variants.map((v) => ({
      ...v,
      constraintViolations: checkHardConstraints(v.body),
    }));
    for (const v of variants) {
      log(`  ${v.angle}: ${v.body.length} chars, ${v.constraintViolations.length} constraint violation(s)`);
    }

    log('critiquing');
    const critique = await runCritic({ research, voice, recentHooks, variants });
    const winner = variants.find((v) => v.angle === critique.winner) ?? variants[0];
    const winnerEval =
      critique.evaluations.find((e) => e.angle === winner.angle) ?? critique.evaluations[0];
    log(`  winner: ${winner.angle} score=${winnerEval.score} autoFails=[${winnerEval.autoFails.join(',')}]`);

    let body = winner.body;
    let score = winnerEval.score;
    let autoFails: string[] = winnerEval.autoFails;
    let issues = winnerEval.issues;
    let strengths = winnerEval.strengths;
    let violations = winner.constraintViolations;
    let revised = false;
    let version = 1;
    let revisionOf: Types.ObjectId | null = null;

    if (!passes(winnerEval, violations)) {
      revisionOf = await saveDraft({
        concept,
        researchId: researchDoc._id,
        angle: winner.angle,
        body,
        score,
        autoFails,
        issues,
        strengths,
        violations,
        version: 1,
        revisionOf: null,
        status: 'rejected',
      });

      log('below the bar; one revision pass');
      const revision = await runReviser({
        research,
        voice,
        failing: { angle: winner.angle, body },
        critique: { ...winnerEval, revisionNotes: critique.revisionNotes },
        constraintViolations: violations,
      });
      revised = true;
      version = 2;
      body = revision.body;
      violations = checkHardConstraints(body);

      log('re-critiquing revision');
      const recritique = await runCritic({
        research,
        voice,
        recentHooks,
        variants: [{ angle: winner.angle, body, constraintViolations: violations }],
      });
      const revEval = recritique.evaluations[0];
      score = revEval.score;
      autoFails = revEval.autoFails;
      issues = revEval.issues;
      strengths = revEval.strengths;
      log(`  revision score=${score} autoFails=[${autoFails.join(',')}]`);
    }

    const passed = passes({ score, autoFails }, violations);
    const draftId = await saveDraft({
      concept,
      researchId: researchDoc._id,
      angle: winner.angle,
      body,
      score,
      autoFails,
      issues,
      strengths,
      violations,
      version,
      revisionOf,
      status: passed ? 'pending' : 'rejected',
    });
    log(`saved draft ${draftId} (${passed ? 'pending review' : 'dead'})`);

    return {
      conceptSlug: concept.slug,
      status: passed ? 'pass' : 'dead',
      draftId: draftId.toString(),
      researchId: researchDoc._id.toString(),
      angle: winner.angle,
      body,
      score,
      autoFails,
      issues,
      constraintViolations: violations,
      revised,
      critique,
    };
  } finally {
    setUsageConcept(null);
  }
}

/* ── concept state transitions ────────────────────────────────────────────── */

/** Claim a backlog concept for a pipeline run. Returns null if it was not in the backlog. */
export async function claimConcept(conceptId: Types.ObjectId | string): Promise<ConceptDoc | null> {
  return Concept.findOneAndUpdate(
    { _id: conceptId, status: 'backlog' },
    { $set: { status: 'selected', coveredAt: new Date(), note: null } },
    { new: true },
  ).lean<ConceptDoc>();
}

/** A run that dies without throwing (request aborted, process killed) can leave
 *  its concept claimed forever, which hides it from the backlog with nothing to
 *  show for it. Anything claimed longer than this with no draft is presumed dead. */
const STALE_CLAIM_MS = 20 * 60 * 1000;

/**
 * Releases concepts stuck in `selected` from an interrupted run. Safe to call
 * on every backlog read: it only touches rows older than the cutoff that have
 * produced no draft at all.
 */
export async function releaseStaleClaims(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - STALE_CLAIM_MS);
  const stuck = await Concept.find({
    status: 'selected',
    coveredAt: { $ne: null, $lt: cutoff },
  }).lean<ConceptDoc[]>();
  if (stuck.length === 0) return 0;

  // A concept with a draft is genuinely mid-review, not stranded.
  const withDrafts = await Draft.find({ conceptId: { $in: stuck.map((c) => c._id) } }, { conceptId: 1 }).lean<
    { conceptId: Types.ObjectId }[]
  >();
  const hasDraft = new Set(withDrafts.map((d) => String(d.conceptId)));
  const orphans = stuck.filter((c) => !hasDraft.has(String(c._id)));
  if (orphans.length === 0) return 0;

  await Concept.updateMany(
    { _id: { $in: orphans.map((c) => c._id) } },
    {
      $set: {
        status: 'backlog',
        coveredAt: null,
        note: 'A previous run was interrupted before it produced a draft. Try again.',
      },
    },
  );
  return orphans.length;
}

/** After drafting: a dead draft returns the concept to the backlog with a note (spec §5.5). */
export async function settleConcept(concept: ConceptDoc, result: DraftRunResult): Promise<void> {
  if (result.status === 'pass') return;
  const note =
    `Draft killed ${new Date().toISOString().slice(0, 10)}: score ${result.score}/10` +
    (result.autoFails.length ? `, auto-fails: ${result.autoFails.join(', ')}` : '') +
    (result.constraintViolations.length ? `, constraints: ${result.constraintViolations.join('; ')}` : '') +
    (result.issues.length ? `. ${result.issues[0]}` : '');
  await Concept.updateOne(
    { _id: concept._id },
    { $set: { status: 'backlog', coveredAt: null, note: note.slice(0, 1_000) } },
  );
}

/** One-shot: claim, research, draft, settle. Used by the CLI and the inline API path. */
export async function generateForConcept(
  conceptIdOrSlug: string,
  opts: DraftOptions & { force?: boolean } = {},
): Promise<DraftRunResult> {
  const log = opts.log ?? noop;
  const found = /^[0-9a-f]{24}$/i.test(conceptIdOrSlug)
    ? await Concept.findById(conceptIdOrSlug).lean<ConceptDoc>()
    : await Concept.findOne({ slug: conceptIdOrSlug }).lean<ConceptDoc>();
  if (!found) throw new Error(`Concept "${conceptIdOrSlug}" not found.`);

  let concept: ConceptDoc | null = await claimConcept(found._id);
  if (!concept) {
    if (!opts.force || found.status === 'retired') {
      throw new Error(`Concept "${found.slug}" is ${found.status}, not in the backlog (pass force to override).`);
    }
    concept = await Concept.findOneAndUpdate(
      { _id: found._id },
      { $set: { status: 'selected', coveredAt: new Date(), note: null } },
      { new: true },
    ).lean<ConceptDoc>();
    if (!concept) throw new Error('Concept vanished mid-claim.');
  }
  log(`=== ${concept.slug} (${concept.track}) ===`);

  try {
    const research = await researchConcept(concept, log);
    const result = await draftFromResearch(concept, research, opts);
    await settleConcept(concept, result);
    return result;
  } catch (e) {
    await Concept.updateOne(
      { _id: concept._id, status: 'selected' },
      { $set: { status: 'backlog', coveredAt: null, note: `Pipeline error: ${(e as Error).message.slice(0, 500)}` } },
    );
    throw e;
  }
}

/** Regenerate from the existing research (no re-fetch), optionally forcing one angle. */
export async function regenerateDraft(
  draftId: Types.ObjectId | string,
  opts: { angle?: Angle; log?: Log } = {},
): Promise<DraftRunResult> {
  const old = await Draft.findById(draftId).lean<DraftDoc>();
  if (!old) throw new Error('Draft not found.');
  if (old.status === 'published') throw new Error('Cannot regenerate a published draft.');
  const [concept, research] = await Promise.all([
    Concept.findById(old.conceptId).lean<ConceptDoc>(),
    Research.findById(old.researchId).lean<ResearchDoc>(),
  ]);
  if (!concept || !research) throw new Error('Concept or research missing for this draft.');

  const result = await draftFromResearch(concept, research, {
    angles: opts.angle ? [opts.angle] : undefined,
    log: opts.log,
  });
  await Draft.updateOne(
    { _id: old._id, status: { $in: ['pending', 'approved'] } },
    { $set: { status: 'rejected', rejectionReason: `Regenerated as ${result.draftId}` } },
  );
  if (result.status === 'pass') {
    await Concept.updateOne({ _id: concept._id }, { $set: { status: 'selected', coveredAt: concept.coveredAt ?? new Date() } });
  } else {
    await settleConcept(concept, result);
  }
  return result;
}
