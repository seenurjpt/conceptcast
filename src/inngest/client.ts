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
