/**
 * Review-queue decisions and the publish/metrics lifecycle (spec §7, §8).
 */
import type { Types } from 'mongoose';
import {
  Concept,
  Draft,
  Publication,
  type DraftDoc,
  type PublicationDoc,
  type PublicationMetrics,
} from './db/models';
import { publishPost, fetchSocialMetrics, LinkedInPublishError } from './publishers/linkedin';
import { applyEngagementFeedback } from './feedback';

export const MAX_PUBLISH_ATTEMPTS = 3;

/* ── human decisions ──────────────────────────────────────────────────────── */

export interface ApproveResult {
  draft: DraftDoc;
  publication: PublicationDoc;
}

/**
 * Approve a pending draft and schedule it. No `scheduledFor` means "now":
 * the row is due immediately and the caller decides whether to publish inline.
 */
export async function approveDraft(draftId: Types.ObjectId | string, scheduledFor?: Date): Promise<ApproveResult> {
  const draft = await Draft.findOneAndUpdate(
    { _id: draftId, status: { $in: ['pending', 'approved'] } },
    { $set: { status: 'approved' } },
    { new: true },
  ).lean<DraftDoc>();
  if (!draft) throw new Error('Draft not found or not approvable.');

  const when = scheduledFor ?? new Date();
  const publication = await Publication.findOneAndUpdate(
    { draftId: draft._id },
    {
      $set: { scheduledFor: when, status: 'scheduled', error: null },
      $setOnInsert: { conceptId: draft.conceptId, attempts: 0, createdAt: new Date() },
    },
    { upsert: true, new: true },
  ).lean<PublicationDoc>();
  if (!publication) throw new Error('Failed to create publication row.');
  await Concept.updateOne({ _id: draft.conceptId }, { $set: { status: 'selected' } });
  return { draft, publication };
}

/** Reject: draft is dead, concept goes back to the backlog with the reason as its note. */
export async function rejectDraft(draftId: Types.ObjectId | string, reason?: string): Promise<DraftDoc> {
  const draft = await Draft.findOneAndUpdate(
    { _id: draftId, status: { $in: ['pending', 'approved'] } },
    { $set: { status: 'rejected', rejectionReason: reason?.trim() || 'Rejected in review' } },
    { new: true },
  ).lean<DraftDoc>();
  if (!draft) throw new Error('Draft not found or not rejectable.');
  await Publication.deleteOne({ draftId: draft._id, status: { $in: ['scheduled', 'failed'] } });
  await Concept.updateOne(
    { _id: draft.conceptId, status: { $ne: 'published' } },
    { $set: { status: 'backlog', coveredAt: null, note: `Rejected in review: ${reason?.trim() || 'no reason given'}` } },
  );
  return draft;
}

/** Human edit-in-place. Recomputes the derived fields. */
export async function editDraft(
  draftId: Types.ObjectId | string,
  body: string,
): Promise<DraftDoc> {
  const hook = body
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .slice(0, 2)
    .join('\n');
  const hashtags = [...body.matchAll(/#[A-Za-z0-9_]+/g)].map((m) => m[0]).slice(0, 3);
  const draft = await Draft.findOneAndUpdate(
    { _id: draftId, status: { $in: ['pending', 'approved'] } },
    { $set: { body, hook, hashtags, charCount: body.length, editedByHuman: true } },
    { new: true },
  ).lean<DraftDoc>();
  if (!draft) throw new Error('Draft not found or not editable.');
  return draft;
}

/* ── publishing ───────────────────────────────────────────────────────────── */

export interface PublishOutcome {
  publicationId: string;
  status: 'published' | 'failed' | 'skipped';
  postUrn?: string;
  error?: string;
}

/**
 * Publish one scheduled row. Claims it atomically (scheduled → publishing) so
 * a cron overlap or Inngest retry cannot double-post (spec: idempotency).
 */
export async function publishPublication(publicationId: Types.ObjectId | string): Promise<PublishOutcome> {
  const claimed = await Publication.findOneAndUpdate(
    { _id: publicationId, status: 'scheduled' },
    { $set: { status: 'publishing' }, $inc: { attempts: 1 } },
    { new: true },
  ).lean<PublicationDoc>();
  if (!claimed) return { publicationId: String(publicationId), status: 'skipped' };

  const draft = await Draft.findById(claimed.draftId).lean<DraftDoc>();
  if (!draft) {
    await Publication.updateOne({ _id: claimed._id }, { $set: { status: 'failed', error: 'Draft missing' } });
    return { publicationId: String(claimed._id), status: 'failed', error: 'Draft missing' };
  }

  try {
    const { postUrn } = await publishPost(draft.body);
    const publishedAt = new Date();
    await Publication.updateOne(
      { _id: claimed._id },
      { $set: { status: 'published', postUrn, publishedAt, error: null } },
    );
    await Draft.updateOne({ _id: draft._id }, { $set: { status: 'published' } });
    await Concept.updateOne(
      { _id: draft.conceptId },
      { $set: { status: 'published', publishedDraftId: draft._id, coveredAt: publishedAt, timelinessBoost: 0 } },
    );
    return { publicationId: String(claimed._id), status: 'published', postUrn };
  } catch (e) {
    const err = e as Error;
    const retryable = err instanceof LinkedInPublishError ? err.retryable : true;
    const giveUp = !retryable || claimed.attempts >= MAX_PUBLISH_ATTEMPTS;
    await Publication.updateOne(
      { _id: claimed._id },
      { $set: { status: giveUp ? 'failed' : 'scheduled', error: err.message.slice(0, 1_000) } },
    );
    return { publicationId: String(claimed._id), status: 'failed', error: err.message };
  }
}

/** Every 15 minutes (spec §7 scheduling): publish rows whose time has come. */
export async function publishDuePublications(now = new Date()): Promise<PublishOutcome[]> {
  const due = await Publication.find({ status: 'scheduled', scheduledFor: { $lte: now } })
    .sort({ scheduledFor: 1 })
    .lean<PublicationDoc[]>();
  const out: PublishOutcome[] = [];
  for (const p of due) out.push(await publishPublication(p._id));
  return out;
}

/* ── metrics ──────────────────────────────────────────────────────────────── */

export async function recordMetrics(
  publicationId: Types.ObjectId | string,
  metrics: Omit<PublicationMetrics, 'fetchedAt'>,
): Promise<{ delta: number }> {
  const r = await Publication.updateOne(
    { _id: publicationId, status: 'published' },
    { $set: { metrics: { ...metrics, fetchedAt: new Date() }, feedbackAppliedAt: null } },
  );
  if (r.matchedCount === 0) throw new Error('Publication not found or not published.');
  const delta = await applyEngagementFeedback(publicationId);
  return { delta };
}

/** 48h job body: pull reactions/comments from LinkedIn and feed them back. */
export async function fetchAndRecordMetrics(
  publicationId: Types.ObjectId | string,
): Promise<{ ok: boolean; reason?: string; metrics?: PublicationMetrics }> {
  const pub = await Publication.findById(publicationId).lean<PublicationDoc>();
  if (!pub || pub.status !== 'published' || !pub.postUrn) return { ok: false, reason: 'not published' };
  if (pub.metrics?.source === 'manual') return { ok: false, reason: 'manual metrics already entered' };
  try {
    const social = await fetchSocialMetrics(pub.postUrn);
    const metrics: Omit<PublicationMetrics, 'fetchedAt'> = {
      impressions: null,
      reactions: social.reactions,
      comments: social.comments,
      shares: 0,
      source: 'api',
    };
    await recordMetrics(pub._id, metrics);
    return { ok: true, metrics: { ...metrics, fetchedAt: new Date() } };
  } catch (e) {
    const err = e as Error;
    // 403 = r_member_social not granted. Not an error worth retrying; the manual field covers it.
    if (err instanceof LinkedInPublishError && (err.status === 403 || err.status === 401)) {
      return { ok: false, reason: `LinkedIn metrics scope not available (${err.status}); enter metrics by hand.` };
    }
    throw e;
  }
}
