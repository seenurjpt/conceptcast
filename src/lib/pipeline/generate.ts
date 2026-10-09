/**
 * The generate-post pipeline (spec §2 boxes 2–5), shared by the CLI, the API
 * routes and the Inngest function. Two halves so Inngest can checkpoint
 * between them: `researchConcept` and `draftFromResearch`.
 */
import mongoose, { type ClientSession, type Types } from 'mongoose';
import { Concept, Research, Draft, type ConceptDoc, type ResearchDoc, type DraftDoc } from '../db/models';
import { withTopic } from './research';
import { freshResearchFor, obtainResearch } from '../research/service';
import { HttpError } from '../api';
import { installUsageSink, setUsageConcept } from '../db/usageSink';
import { dropMediumConfidence } from '../agents/researcher';
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
  /** The term the post opens with. */
  term: string | null;
  body: string;
  score: number;
  autoFails: string[];
  issues: string[];
  constraintViolations: string[];
  revised: boolean;
  critique: Critique;
}

/** First two non-empty lines: what LinkedIn shows before the fold. */
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

/* ── half 1 lives in ./research.ts ──────────────────────────────────────── */

export { researchConcept, withTopic } from './research';

/* ── half 2: write → critique → (revise) → persist ────────────────────────── */

interface DraftSaveInput {
  concept: ConceptDoc;
  researchId: Types.ObjectId;
  angle: Angle;
  /** The term the post opens with; saved so later edits are checked against it. */
  term: string | null;
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

async function saveDraft(d: DraftSaveInput, session?: ClientSession): Promise<Types.ObjectId> {
  const [doc] = await Draft.create(
    [
      {
        conceptId: d.concept._id,
        researchId: d.researchId,
        angle: d.angle,
        term: d.term,
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
      },
    ],
    { session },
  );
  return doc._id;
}

export interface DraftOptions {
  /** Defaults to the track-rotated three from `pickAngles`. A single angle writes one variant. */
  angles?: Angle[];
  log?: Log;
}

/**
 * A finished draft run that has not touched the database: the versions to
 * save (a rejected first version when it needed a revision, then the final
 * one) and the outcome. Composing and saving are separate so the Write path
 * can do all the slow AI work first and then commit in one transaction.
 */
export interface ComposedDraft {
  /** In save order; each later version is saved as a revision of the one before. */
  versions: Omit<DraftSaveInput, 'revisionOf'>[];
  result: Omit<DraftRunResult, 'draftId'>;
}

export async function composeDraft(
  concept: ConceptDoc,
  researchDoc: ResearchDoc,
  opts: DraftOptions = {},
): Promise<ComposedDraft> {
  const log = opts.log ?? noop;
  installUsageSink();
  setUsageConcept(concept.slug);
  try {
    const research = dropMediumConfidence(toResearchOutput(researchDoc));
    const angles = opts.angles?.length ? opts.angles : pickAngles(concept);
    const [voice, recent] = await Promise.all([loadVoiceContext(), recentPublished(10)]);
    const recentHooks = recent.map((r) => r.hook).filter(Boolean);

    log(`writing ${angles.length} variant(s): ${angles.join(', ')}`);
    const written = await runWriter({ concept: await withTopic(concept), research, voice, angles });
    const variants: VariantForCritique[] = written.variants.map((v) => ({
      ...v,
      constraintViolations: checkHardConstraints(v.body, { term: v.term }),
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
    let term = winner.term ?? null;
    let score = winnerEval.score;
    let autoFails: string[] = winnerEval.autoFails;
    let issues = winnerEval.issues;
    let strengths = winnerEval.strengths;
    let violations = winner.constraintViolations;
    let revised = false;
    let version = 1;
    const versions: ComposedDraft['versions'] = [];

    if (!passes(winnerEval, violations)) {
      // Kept as history: the first version, saved as rejected, with the
      // revision pointing back at it.
      versions.push({
        concept,
        researchId: researchDoc._id,
        angle: winner.angle,
        term,
        body,
        score,
        autoFails,
        issues,
        strengths,
        violations,
        version: 1,
        status: 'rejected',
      });

      log('below the bar; one revision pass');
      const revision = await runReviser({
        research,
        voice,
        failing: { angle: winner.angle, term: term ?? undefined, body },
        critique: { ...winnerEval, revisionNotes: critique.revisionNotes },
        constraintViolations: violations,
      });
      revised = true;
      version = 2;
      body = revision.body;
      term = revision.term ?? term;
      violations = checkHardConstraints(body, { term });

      log('re-critiquing revision');
      const recritique = await runCritic({
        research,
        voice,
        recentHooks,
        variants: [{ angle: winner.angle, term: term ?? undefined, body, constraintViolations: violations }],
      });
      const revEval = recritique.evaluations[0];
      score = revEval.score;
      autoFails = revEval.autoFails;
      issues = revEval.issues;
      strengths = revEval.strengths;
      log(`  revision score=${score} autoFails=[${autoFails.join(',')}]`);
    }

    const passed = passes({ score, autoFails }, violations);
    versions.push({
      concept,
      researchId: researchDoc._id,
      angle: winner.angle,
      term,
      body,
      score,
      autoFails,
      issues,
      strengths,
      violations,
      version,
      status: passed ? 'pending' : 'rejected',
    });

    return {
      versions,
      result: {
        conceptSlug: concept.slug,
        status: passed ? 'pass' : 'dead',
        researchId: researchDoc._id.toString(),
        angle: winner.angle,
        term,
        body,
        score,
        autoFails,
        issues,
        constraintViolations: violations,
        revised,
        critique,
      },
    };
  } finally {
    setUsageConcept(null);
  }
}

/** Saves a composed run's versions, linked in order. Returns the final draft's id. */
export async function persistDraft(composed: ComposedDraft, session?: ClientSession): Promise<Types.ObjectId> {
  let previous: Types.ObjectId | null = null;
  for (const v of composed.versions) {
    previous = await saveDraft({ ...v, revisionOf: previous }, session);
  }
  if (!previous) throw new Error('A draft run produced nothing to save.');
  return previous;
}

/** Compose and save straight away. Used by the CLI, regenerate and the Inngest job. */
export async function draftFromResearch(
  concept: ConceptDoc,
  researchDoc: ResearchDoc,
  opts: DraftOptions = {},
): Promise<DraftRunResult> {
  const log = opts.log ?? noop;
  const composed = await composeDraft(concept, researchDoc, opts);
  const draftId = await persistDraft(composed);
  log(`saved draft ${draftId} (${composed.result.status === 'pass' ? 'pending review' : 'dead'})`);
  return { ...composed.result, draftId: draftId.toString() };
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

  // A concept with a live draft is genuinely mid-review, not stranded. A
  // rejected one does not count: a run cut off after saving its rejected
  // first version, before the revision, is just as stranded.
  const withDrafts = await Draft.find(
    { conceptId: { $in: stuck.map((c) => c._id) }, status: { $in: ['pending', 'approved', 'published'] } },
    { conceptId: 1 },
  ).lean<
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
    // Fresh research (from the background pool or an earlier run) is reused;
    // a run already in progress is waited for; otherwise research now.
    const research = await obtainResearch(concept, log);
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

/* ── the Write step: all or nothing ───────────────────────────────────────── */

/** How long one Write may hold its subtopic: Vercel's function limit. */
const WRITE_LEASE_MS = 300_000;

/** Why a draft was killed, kept on the subtopic so the next run can see it. */
function deadNote(result: Omit<DraftRunResult, 'draftId'>): string {
  const note =
    `Draft killed ${new Date().toISOString().slice(0, 10)}: score ${result.score}/10` +
    (result.autoFails.length ? `, auto-fails: ${result.autoFails.join(', ')}` : '') +
    (result.constraintViolations.length ? `, constraints: ${result.constraintViolations.join('; ')}` : '') +
    (result.issues.length ? `. ${result.issues[0]}` : '');
  return note.slice(0, 1_000);
}

/**
 * Write a post for a subtopic whose research is done, atomically.
 *
 * The subtopic never leaves the backlog while this runs: a lease
 * (`writeLockedUntil`) stops a second Write, and nothing else changes. All
 * the AI work (write, critique, revise) happens first and saves nothing.
 * Then one transaction saves the drafts and moves the subtopic on, only if
 * the lease is still ours. So the outcome is either "drafted" or "exactly as
 * before": an error, a timeout or a killed function leaves no half state,
 * and an abandoned lease just runs out.
 */
export async function writePost(
  slug: string,
  opts: DraftOptions & {
    /** The AI half; replaceable so tests can exercise the commit rules without model calls. */
    compose?: typeof composeDraft;
  } = {},
): Promise<DraftRunResult> {
  const log = opts.log ?? noop;
  const now = new Date();
  const until = new Date(now.getTime() + WRITE_LEASE_MS);
  const concept = await Concept.findOneAndUpdate(
    { slug, status: 'backlog', $or: [{ writeLockedUntil: null }, { writeLockedUntil: { $lte: now } }] },
    { $set: { writeLockedUntil: until } },
    { new: true },
  ).lean<ConceptDoc>();
  if (!concept) {
    const found = await Concept.findOne({ slug }, { status: 1 }).lean<Pick<ConceptDoc, 'status'>>();
    if (!found) throw new HttpError(404, 'Subtopic not found.');
    if (found.status !== 'backlog') throw new HttpError(409, `This subtopic is ${found.status}, not waiting to be written.`);
    throw new HttpError(409, 'This subtopic is already being written. Give it a minute.');
  }

  // Our lease is the exact time we set; matching on it means we never touch a
  // newer Write's lease.
  const release = () => Concept.updateOne({ _id: concept._id, writeLockedUntil: until }, { $set: { writeLockedUntil: null } });
  try {
    const research = await freshResearchFor(concept);
    if (!research) throw new HttpError(409, 'Research for this subtopic is not ready yet. Run research first.');

    const composed = await (opts.compose ?? composeDraft)(concept, research, opts);
    if (Date.now() >= until.getTime()) {
      throw new Error('Writing took longer than the time allowed, so nothing was saved. Try again.');
    }

    const passed = composed.result.status === 'pass';
    let draftId: Types.ObjectId | null = null;
    await mongoose.connection.transaction(async (session) => {
      const moved = await Concept.updateOne(
        { _id: concept._id, status: 'backlog', writeLockedUntil: until },
        passed
          ? { $set: { status: 'selected', coveredAt: new Date(), note: null, writeLockedUntil: null } }
          : { $set: { note: deadNote(composed.result), writeLockedUntil: null } },
        { session },
      );
      if (moved.modifiedCount !== 1) {
        throw new Error('This subtopic changed while it was being written, so nothing was saved. Try again.');
      }
      draftId = await persistDraft(composed, session);
    });
    if (!draftId) throw new Error('The draft was not saved.');
    log(`saved draft ${draftId} (${passed ? 'pending review' : 'dead'})`);
    return { ...composed.result, draftId: String(draftId) };
  } catch (e) {
    await release().catch(() => {});
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
