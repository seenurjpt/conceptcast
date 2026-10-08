import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { type SourceType } from '../concepts/seed';

/* ── concepts ─────────────────────────────────────────────────────────────── */

export const CONCEPT_STATUSES = ['backlog', 'selected', 'published', 'retired'] as const;
export type ConceptStatus = (typeof CONCEPT_STATUSES)[number];

export interface PrimarySourceDoc {
  type: SourceType;
  url: string;
  title: string;
}

export interface ConceptDoc {
  _id: Types.ObjectId;
  slug: string;
  title: string;
  /** Legacy grouping. Migrated rows keep their track name; user subtopics are 'custom'. */
  track: string;
  /** The main topic this subtopic belongs to. Null only for a legacy row not yet migrated. */
  topicId: Types.ObjectId | null;
  oneLiner: string;
  focus: string;
  prerequisites: string[];
  difficulty: 1 | 2 | 3;
  primarySources: PrimarySourceDoc[];
  devRelevance: number;
  status: ConceptStatus;
  coveredAt: Date | null;
  publishedDraftId: Types.ObjectId | null;
  timelinessBoost: number;
  /** Why the last pipeline run killed the draft (spec 5.5), or a human note. */
  note: string | null;
  /** Where the topic came from. News topics are perishable; the UI shows their age. */
  origin: 'seed' | 'proposal' | 'news' | 'user' | 'suggested';
  /** For news topics: when the story broke. */
  storyDate: Date | null;
  /** Background research pool bookkeeping (lib/research). */
  researchState: ResearchState;
  createdAt: Date;
}

export const RESEARCH_STATUSES = ['idle', 'running', 'ready', 'failed'] as const;
export type ResearchStatus = (typeof RESEARCH_STATUSES)[number];

/**
 * Whether this subtopic has research waiting, and the lease that stops two
 * runs researching it at once. `ready` is a cache of "the latest Research
 * row is fresh"; freshness itself is judged from `readyAt` and the origin.
 */
export interface ResearchState {
  status: ResearchStatus;
  /** When the latest research finished. */
  readyAt: Date | null;
  researchId: Types.ObjectId | null;
  /** A running lease expires here; a dead run is retaken after it. */
  lockedUntil: Date | null;
  startedAt: Date | null;
  /** 'pool' = background prefetch; 'on-demand' = started by Write a post. */
  source: 'pool' | 'on-demand' | null;
  error: string | null;
  /** After a failed background run the pool skips this subtopic until then. */
  retryAfter: Date | null;
}

export const EMPTY_RESEARCH_STATE: ResearchState = {
  status: 'idle',
  readyAt: null,
  researchId: null,
  lockedUntil: null,
  startedAt: null,
  source: null,
  error: null,
  retryAfter: null,
};

const ResearchStateSchema = new Schema<ResearchState>(
  {
    status: { type: String, required: true, enum: RESEARCH_STATUSES, default: 'idle' },
    readyAt: { type: Date, default: null },
    researchId: { type: Schema.Types.ObjectId, ref: 'Research', default: null },
    lockedUntil: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    source: { type: String, enum: ['pool', 'on-demand', null], default: null },
    error: { type: String, default: null },
    retryAfter: { type: Date, default: null },
  },
  { _id: false },
);

const PrimarySourceSchema = new Schema<PrimarySourceDoc>(
  {
    type: { type: String, required: true, enum: ['paper', 'docs', 'repo', 'blog'] },
    url: { type: String, required: true },
    title: { type: String, required: true },
  },
  { _id: false },
);

const ConceptSchema = new Schema<ConceptDoc>({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  track: { type: String, required: true, default: 'custom' },
  topicId: { type: Schema.Types.ObjectId, ref: 'Topic', default: null, index: true },
  oneLiner: { type: String, default: '' },
  focus: { type: String, default: '' },
  prerequisites: { type: [String], required: true, default: [] },
  difficulty: { type: Number, required: true, min: 1, max: 3, default: 2 },
  primarySources: { type: [PrimarySourceSchema], required: true, default: [] },
  devRelevance: { type: Number, required: true, min: 0, max: 10, default: 5 },
  status: { type: String, required: true, enum: CONCEPT_STATUSES, default: 'backlog' },
  coveredAt: { type: Date, default: null },
  publishedDraftId: { type: Schema.Types.ObjectId, ref: 'Draft', default: null },
  timelinessBoost: { type: Number, required: true, default: 0 },
  note: { type: String, default: null },
  origin: { type: String, required: true, enum: ['seed', 'proposal', 'news', 'user', 'suggested'], default: 'seed' },
  storyDate: { type: Date, default: null },
  researchState: { type: ResearchStateSchema, default: () => ({ ...EMPTY_RESEARCH_STATE }) },
  createdAt: { type: Date, required: true, default: () => new Date() },
});
ConceptSchema.index({ status: 1, track: 1 });
ConceptSchema.index({ 'researchState.status': 1, 'researchState.lockedUntil': 1 });

/* ── research ─────────────────────────────────────────────────────────────── */

export interface ResearchDoc {
  _id: Types.ObjectId;
  conceptId: Types.ObjectId;
  mechanism: string;
  facts: {
    text: string;
    sourceUrl: string;
    sourceTitle: string | null;
    type: 'number' | 'behaviour' | 'tradeoff' | 'gotcha';
    confidence: 'high' | 'medium';
  }[];
  misconceptions: { belief: string; reality: string; sourceUrl: string }[];
  codeExample: { language: string; snippet: string; explanation: string } | null;
  devImplication: string;
  analogyCandidates: string[];
  /** Which primary sources actually resolved when this research was produced. */
  resolvedSources: { url: string; chars: number; truncated: boolean }[];
  fetchedAt: Date;
}

const ResearchSchema = new Schema<ResearchDoc>({
  conceptId: { type: Schema.Types.ObjectId, ref: 'Concept', required: true, index: true },
  mechanism: { type: String, required: true },
  facts: {
    type: [
      new Schema(
        {
          text: { type: String, required: true },
          sourceUrl: { type: String, required: true },
          sourceTitle: { type: String, default: null },
          type: { type: String, required: true, enum: ['number', 'behaviour', 'tradeoff', 'gotcha'] },
          confidence: { type: String, required: true, enum: ['high', 'medium'] },
        },
        { _id: false },
      ),
    ],
    required: true,
  },
  misconceptions: {
    type: [
      new Schema(
        {
          belief: { type: String, required: true },
          reality: { type: String, required: true },
          sourceUrl: { type: String, required: true },
        },
        { _id: false },
      ),
    ],
    required: true,
  },
  codeExample: {
    type: new Schema(
      {
        language: { type: String, required: true },
        snippet: { type: String, required: true },
        explanation: { type: String, required: true },
      },
      { _id: false },
    ),
    default: null,
  },
  devImplication: { type: String, required: true },
  analogyCandidates: { type: [String], required: true, default: [] },
  resolvedSources: {
    type: [
      new Schema(
        {
          url: { type: String, required: true },
          chars: { type: Number, required: true },
          truncated: { type: Boolean, required: true },
        },
        { _id: false },
      ),
    ],
    required: true,
    default: [],
  },
  fetchedAt: { type: Date, required: true, default: () => new Date() },
});

/* ── drafts ───────────────────────────────────────────────────────────────── */

/**
 * The writer's angles are the first four; 'announcement' and 'custom' are
 * only ever the angle of a draft of that kind.
 */
export const DRAFT_ANGLES = ['mechanism', 'misconception', 'tradeoff', 'debug-story', 'announcement', 'custom'] as const;
export type DraftAngle = (typeof DRAFT_ANGLES)[number];
export const DRAFT_STATUSES = ['pending', 'approved', 'rejected', 'published'] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];
/**
 * 'post' = a researched explainer about one subtopic.
 * 'announcement' = a short "I'm starting to learn <topic>" post: no subtopic,
 * no research, no critic score, so those fields are null for it.
 * 'custom' = a post the author wrote in the composer (optionally polished by
 * AI): no subtopic, research or critic either, and only LinkedIn's own
 * length limit applies to it.
 */
export const DRAFT_KINDS = ['post', 'announcement', 'custom'] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

export interface DraftCritique {
  score: number;
  issues: string[];
  strengths: string[];
  depthPassed: boolean;
  revisionOf: Types.ObjectId | null;
}

export interface DraftDoc {
  _id: Types.ObjectId;
  /** Older rows have no kind; treat a missing one as 'post'. */
  kind: DraftKind;
  /** Null only for announcements. */
  conceptId: Types.ObjectId | null;
  /** Null only for announcements. */
  researchId: Types.ObjectId | null;
  /** The main topic an announcement is about; null for posts (they reach it through the concept). */
  topicId: Types.ObjectId | null;
  angle: DraftAngle;
  /**
   * The concept's name as the post opens with it ("Backpressure"). Set by the
   * writer; edits are re-checked against it. Null on older drafts and on
   * announcements and custom posts, which have no term rule.
   */
  term: string | null;
  hook: string;
  body: string;
  charCount: number;
  hashtags: string[];
  /** Null only for announcements, which get the machine checks but no critic. */
  critique: DraftCritique | null;
  /** What the author typed for an announcement, so "Write it again" keeps it. */
  announce: { why: string | null; goal?: string | null; cadence: string | null } | null;
  version: number;
  status: DraftStatus;
  editedByHuman: boolean;
  /** Set when the human rejects; feeds the concept's note. */
  rejectionReason: string | null;
  createdAt: Date;
}

const DraftSchema = new Schema<DraftDoc>({
  kind: { type: String, required: true, enum: DRAFT_KINDS, default: 'post' },
  conceptId: { type: Schema.Types.ObjectId, ref: 'Concept', default: null, index: true },
  researchId: { type: Schema.Types.ObjectId, ref: 'Research', default: null },
  topicId: { type: Schema.Types.ObjectId, ref: 'Topic', default: null, index: true },
  angle: { type: String, required: true, enum: DRAFT_ANGLES },
  term: { type: String, default: null },
  hook: { type: String, required: true },
  body: { type: String, required: true },
  charCount: { type: Number, required: true },
  hashtags: { type: [String], required: true, default: [] },
  critique: {
    type: new Schema(
      {
        score: { type: Number, required: true, min: 1, max: 10 },
        issues: { type: [String], required: true, default: [] },
        strengths: { type: [String], required: true, default: [] },
        depthPassed: { type: Boolean, required: true },
        revisionOf: { type: Schema.Types.ObjectId, ref: 'Draft', default: null },
      },
      { _id: false },
    ),
    default: null,
  },
  announce: {
    type: new Schema(
      { why: { type: String, default: null }, goal: { type: String, default: null }, cadence: { type: String, default: null } },
      { _id: false },
    ),
    default: null,
  },
  version: { type: Number, required: true, default: 1 },
  status: { type: String, required: true, enum: DRAFT_STATUSES, default: 'pending', index: true },
  editedByHuman: { type: Boolean, required: true, default: false },
  rejectionReason: { type: String, default: null },
  createdAt: { type: Date, required: true, default: () => new Date() },
});

/* ── publications ─────────────────────────────────────────────────────────── */

export const PUBLICATION_STATUSES = ['scheduled', 'publishing', 'published', 'failed'] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export interface PublicationMetrics {
  /** LinkedIn does not expose impressions for member posts; null unless entered by hand. */
  impressions: number | null;
  reactions: number;
  comments: number;
  shares: number;
  source: 'api' | 'manual';
  fetchedAt: Date;
}

export interface PublicationDoc {
  _id: Types.ObjectId;
  draftId: Types.ObjectId;
  /** Null for an announcement, which has no subtopic. */
  conceptId: Types.ObjectId | null;
  scheduledFor: Date;
  publishedAt: Date | null;
  postUrn: string | null;
  status: PublicationStatus;
  error: string | null;
  attempts: number;
  metrics: PublicationMetrics | null;
  /** Prevents the engagement feedback nudge from being applied twice. */
  feedbackAppliedAt: Date | null;
  /** Append the "Posted from conceptcast" line when this row is published. */
  watermark: boolean;
  /** How the credit went out when published: link card, text-line fallback, none (no room), or null (off). */
  credit: 'card' | 'text' | 'none' | null;
  createdAt: Date;
}

const PublicationSchema = new Schema<PublicationDoc>({
  draftId: { type: Schema.Types.ObjectId, ref: 'Draft', required: true, unique: true },
  conceptId: { type: Schema.Types.ObjectId, ref: 'Concept', default: null },
  scheduledFor: { type: Date, required: true, index: true },
  publishedAt: { type: Date, default: null },
  postUrn: { type: String, default: null },
  status: { type: String, required: true, enum: PUBLICATION_STATUSES, default: 'scheduled' },
  error: { type: String, default: null },
  attempts: { type: Number, required: true, default: 0 },
  metrics: {
    type: new Schema(
      {
        impressions: { type: Number, default: null },
        reactions: { type: Number, required: true },
        comments: { type: Number, required: true },
        shares: { type: Number, required: true },
        source: { type: String, required: true, enum: ['api', 'manual'] },
        fetchedAt: { type: Date, required: true },
      },
      { _id: false },
    ),
    default: null,
  },
  feedbackAppliedAt: { type: Date, default: null },
  watermark: { type: Boolean, required: true, default: false },
  credit: { type: String, enum: ['card', 'text', 'none', null], default: null },
  createdAt: { type: Date, required: true, default: () => new Date() },
});

/* ── voiceProfile (singleton) ─────────────────────────────────────────────── */

export const DEFAULT_AUDIENCE =
  'mid-level full-stack developers, mostly JS/TS, who use LLM APIs but have not read a paper.';

export interface VoiceProfileDoc {
  _id: Types.ObjectId;
  /** Always 'singleton': there is exactly one voice profile. */
  key: string;
  styleGuide: string;
  audienceDescription: string;
  examplePosts: string[];
  updatedAt: Date;
}

const VoiceProfileSchema = new Schema<VoiceProfileDoc>({
  key: { type: String, required: true, unique: true, default: 'singleton' },
  // Not `required`: an empty style guide is the legitimate pre-bootstrap state,
  // and Mongoose treats '' as missing, which would reject the default profile.
  styleGuide: { type: String, default: '' },
  audienceDescription: { type: String, default: DEFAULT_AUDIENCE },
  examplePosts: { type: [String], required: true, default: [] },
  updatedAt: { type: Date, required: true, default: () => new Date() },
});

/* ── linkedInAuth (singleton; one personal account, so no credentials table) ── */

export interface LinkedInAuthDoc {
  _id: Types.ObjectId;
  key: string;
  accessToken: string;
  refreshToken: string | null;
  /** When the access token expires (LinkedIn: 60 days). */
  expiresAt: Date;
  /** When the refresh token expires (LinkedIn: 365 days). */
  refreshExpiresAt: Date | null;
  memberUrn: string;
  memberName: string | null;
  memberPicture: string | null;
  memberEmail: string | null;
  scopes: string[];
  /** The link card's thumbnail, uploaded once to LinkedIn and reused (lib/linkCard.ts). */
  cardImageUrn: string | null;
  /** The member who owns that image; a different account needs its own upload. */
  cardImageOwner: string | null;
  cardImageAt: Date | null;
  updatedAt: Date;
}

const LinkedInAuthSchema = new Schema<LinkedInAuthDoc>({
  key: { type: String, required: true, unique: true, default: 'singleton' },
  accessToken: { type: String, required: true },
  refreshToken: { type: String, default: null },
  expiresAt: { type: Date, required: true },
  refreshExpiresAt: { type: Date, default: null },
  memberUrn: { type: String, required: true },
  memberName: { type: String, default: null },
  memberPicture: { type: String, default: null },
  memberEmail: { type: String, default: null },
  scopes: { type: [String], required: true, default: [] },
  cardImageUrn: { type: String, default: null },
  cardImageOwner: { type: String, default: null },
  cardImageAt: { type: Date, default: null },
  updatedAt: { type: Date, required: true, default: () => new Date() },
});

/* ── conceptProposals (monthly backlog-growth job) ────────────────────────── */

export const PROPOSAL_STATUSES = ['pending', 'accepted', 'rejected', 'expired'] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

/** The story behind a news-sourced proposal: what the feeds said and where. */
export interface NewsStory {
  headline: string;
  links: { url: string; title: string; feed: string; publishedAt: Date | null }[];
  newestAt: Date | null;
  clusterSize: number;
  /** Deterministic cluster score (coverage + recency), not the model's. */
  score: number;
}

export interface ConceptProposalDoc {
  _id: Types.ObjectId;
  slug: string;
  title: string;
  track: string;
  oneLiner: string;
  focus: string;
  prerequisites: string[];
  difficulty: 1 | 2 | 3;
  devRelevance: number;
  primarySources: PrimarySourceDoc[];
  rationale: string;
  status: ProposalStatus;
  /** 'model' = the monthly propose-10 job; 'news' = the daily feed scan. */
  source: 'model' | 'news';
  story: NewsStory | null;
  /** News proposals expire unaccepted; model proposals never do. */
  expiresAt: Date | null;
  createdAt: Date;
}

const ConceptProposalSchema = new Schema<ConceptProposalDoc>({
  slug: { type: String, required: true, index: true },
  title: { type: String, required: true },
  track: { type: String, required: true, default: 'custom' },
  oneLiner: { type: String, default: '' },
  focus: { type: String, default: '' },
  prerequisites: { type: [String], required: true, default: [] },
  difficulty: { type: Number, required: true, min: 1, max: 3, default: 2 },
  devRelevance: { type: Number, required: true, min: 0, max: 10, default: 5 },
  primarySources: { type: [PrimarySourceSchema], required: true, default: [] },
  rationale: { type: String, required: true },
  status: { type: String, required: true, enum: PROPOSAL_STATUSES, default: 'pending', index: true },
  source: { type: String, required: true, enum: ['model', 'news'], default: 'model', index: true },
  story: {
    type: new Schema<NewsStory>(
      {
        headline: { type: String, required: true },
        links: {
          type: [
            new Schema(
              {
                url: { type: String, required: true },
                title: { type: String, required: true },
                feed: { type: String, required: true, default: '' },
                publishedAt: { type: Date, default: null },
              },
              { _id: false },
            ),
          ],
          required: true,
          default: [],
        },
        newestAt: { type: Date, default: null },
        clusterSize: { type: Number, required: true, default: 1 },
        score: { type: Number, required: true, default: 0 },
      },
      { _id: false },
    ),
    default: null,
  },
  expiresAt: { type: Date, default: null },
  createdAt: { type: Date, required: true, default: () => new Date() },
});

/* ── usage (token accounting per call) ────────────────────────────────────── */

export interface UsageDoc {
  _id: Types.ObjectId;
  at: Date;
  stage: string;
  model: string;
  conceptSlug: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  webSearches: number;
}

const UsageSchema = new Schema<UsageDoc>({
  at: { type: Date, required: true, default: () => new Date() },
  stage: { type: String, required: true },
  model: { type: String, required: true },
  conceptSlug: { type: String, default: null },
  inputTokens: { type: Number, required: true },
  outputTokens: { type: Number, required: true },
  cacheCreationTokens: { type: Number, required: true, default: 0 },
  cacheReadTokens: { type: Number, required: true, default: 0 },
  webSearches: { type: Number, required: true, default: 0 },
});

/* ── topics (a main topic groups subtopics; subtopics are Concept rows) ───── */

export const TOPIC_ORIGINS = ['migrated', 'user'] as const;
export type TopicOrigin = (typeof TOPIC_ORIGINS)[number];

export interface TopicDoc {
  _id: Types.ObjectId;
  /** null = shared (a legacy track migrated into a topic); otherwise the creating user. */
  ownerUserId: string | null;
  slug: string;
  title: string;
  description: string;
  origin: TopicOrigin;
  archived: boolean;
  /**
   * Users who started this shared topic ("Start this topic"), which makes it
   * one of their topics without copying it or its subtopics. Always empty for
   * a user's own topic, which is theirs by ownership.
   */
  startedBy: string[];
  createdAt: Date;
}

const TopicSchema = new Schema<TopicDoc>({
  ownerUserId: { type: String, default: null, index: true },
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  origin: { type: String, required: true, enum: TOPIC_ORIGINS, default: 'user' },
  archived: { type: Boolean, required: true, default: false },
  startedBy: { type: [String], required: true, default: [] },
  createdAt: { type: Date, required: true, default: () => new Date() },
});

/* ── model registration (idempotent under dev reload) ─────────────────────── */

function getModel<T>(name: string, schema: Schema<T>): Model<T> {
  // A dev hot reload re-runs this file with the edited schema. Reusing the
  // cached model would keep the old one (a new enum value is then rejected
  // until the server restarts), so in development it is replaced instead.
  if (process.env.NODE_ENV !== 'production' && mongoose.models[name]) mongoose.deleteModel(name);
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

export const Topic = getModel<TopicDoc>('Topic', TopicSchema);
export const Concept = getModel<ConceptDoc>('Concept', ConceptSchema);
export const Research = getModel<ResearchDoc>('Research', ResearchSchema);
export const Draft = getModel<DraftDoc>('Draft', DraftSchema);
export const Publication = getModel<PublicationDoc>('Publication', PublicationSchema);
export const VoiceProfile = getModel<VoiceProfileDoc>('VoiceProfile', VoiceProfileSchema);
export const LinkedInAuth = getModel<LinkedInAuthDoc>('LinkedInAuth', LinkedInAuthSchema);
export const ConceptProposal = getModel<ConceptProposalDoc>('ConceptProposal', ConceptProposalSchema);
export const Usage = getModel<UsageDoc>('Usage', UsageSchema);

/** Ensures every declared index exists (used by the seed script). */
export async function syncAllIndexes(): Promise<void> {
  await Promise.all([
    Topic.syncIndexes(),
    Concept.syncIndexes(),
    Research.syncIndexes(),
    Draft.syncIndexes(),
    Publication.syncIndexes(),
    VoiceProfile.syncIndexes(),
    LinkedInAuth.syncIndexes(),
    ConceptProposal.syncIndexes(),
    Usage.syncIndexes(),
  ]);
}
