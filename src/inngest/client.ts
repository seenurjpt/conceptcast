import { Inngest } from 'inngest';

/** Event names used across functions and API routes. */
export const EVENTS = {
  /** Force-run the pipeline for one concept (`concepts/[slug]/generate`). */
  generateRequested: 'pipeline/generate.requested',
  /** Emitted after a successful LinkedIn publish; starts the 48h metrics timer. */
  published: 'publication/published',
} as const;

export interface GenerateRequestedData {
  conceptId: string;
  angle?: 'mechanism' | 'misconception' | 'tradeoff' | 'debug-story';
  force?: boolean;
}

export interface PublishedData {
  publicationId: string;
}

export const inngest = new Inngest({ id: 'conceptcast' });

/* ── post-generation pipeline (spec: ConceptCast post generation) ─────────── */

export const POST_EVENTS = {
  /** `POST /api/posts/generate` → 4-stage pipeline for one topic. */
  postRequested: 'conceptcast/post.requested',
  /** Manual or every-30-approvals voice profile re-extraction. */
  voiceExtract: 'conceptcast/voice.extract',
} as const;

export interface PostRequestedData {
  userId: string;
  topicId: string;
  /** Pre-created generation_runs id so the API can return it immediately. */
  runId: string;
  /** Part of the idempotency key: YYYY-MM-DD, or a unique token when force=true. */
  dateBucket: string;
  force?: boolean;
}

export interface VoiceExtractData {
  userId: string;
}
