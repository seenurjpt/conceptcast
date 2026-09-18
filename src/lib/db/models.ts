import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { TRACKS, type Track, type SourceType } from '../concepts/seed';

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
  track: Track;
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
  createdAt: Date;
}

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
  track: { type: String, required: true, enum: TRACKS },
  oneLiner: { type: String, required: true },
  focus: { type: String, required: true },
  prerequisites: { type: [String], required: true, default: [] },
  difficulty: { type: Number, required: true, min: 1, max: 3 },
  primarySources: { type: [PrimarySourceSchema], required: true },
  devRelevance: { type: Number, required: true, min: 0, max: 10 },
  status: { type: String, required: true, enum: CONCEPT_STATUSES, default: 'backlog' },
  coveredAt: { type: Date, default: null },
  publishedDraftId: { type: Schema.Types.ObjectId, ref: 'Draft', default: null },
  timelinessBoost: { type: Number, required: true, default: 0 },
  note: { type: String, default: null },
  createdAt: { type: Date, required: true, default: () => new Date() },
});
ConceptSchema.index({ status: 1, track: 1 });

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

export const DRAFT_ANGLES = ['mechanism', 'misconception', 'tradeoff', 'debug-story'] as const;
export type DraftAngle = (typeof DRAFT_ANGLES)[number];
export const DRAFT_STATUSES = ['pending', 'approved', 'rejected', 'published'] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export interface DraftDoc {
  _id: Types.ObjectId;
  conceptId: Types.ObjectId;
  researchId: Types.ObjectId;
  angle: DraftAngle;
  hook: string;
  body: string;
  charCount: number;
  hashtags: string[];
  critique: {
    score: number;
    issues: string[];
    strengths: string[];
    depthPassed: boolean;
    revisionOf: Types.ObjectId | null;
  };
  version: number;
  status: DraftStatus;
  editedByHuman: boolean;
  /** Set when the human rejects; feeds the concept's note. */
  rejectionReason: string | null;
  createdAt: Date;
}

const DraftSchema = new Schema<DraftDoc>({
  conceptId: { type: Schema.Types.ObjectId, ref: 'Concept', required: true, index: true },
  researchId: { type: Schema.Types.ObjectId, ref: 'Research', required: true },
  angle: { type: String, required: true, enum: DRAFT_ANGLES },
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
    required: true,
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
  conceptId: Types.ObjectId;
  scheduledFor: Date;
  publishedAt: Date | null;
  postUrn: string | null;
  status: PublicationStatus;
  error: string | null;
  attempts: number;
  metrics: PublicationMetrics | null;
  /** Prevents the engagement feedback nudge from being applied twice. */
  feedbackAppliedAt: Date | null;
  createdAt: Date;
}

const PublicationSchema = new Schema<PublicationDoc>({
  draftId: { type: Schema.Types.ObjectId, ref: 'Draft', required: true, unique: true },
  conceptId: { type: Schema.Types.ObjectId, ref: 'Concept', required: true },
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
  createdAt: { type: Date, required: true, default: () => new Date() },
});

/* ── voiceProfile (singleton) ─────────────────────────────────────────────── */

export const DEFAULT_AUDIENCE =
  'mid-level full-stack developers, mostly JS/TS, who use LLM APIs but have not read a paper.';

export interface VoiceProfileDoc {
  _id: Types.ObjectId;
  /** Always 'singleton' — there is exactly one voice profile. */
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
  updatedAt: { type: Date, required: true, default: () => new Date() },
});

/* ── conceptProposals (monthly backlog-growth job) ────────────────────────── */

export const PROPOSAL_STATUSES = ['pending', 'accepted', 'rejected'] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export interface ConceptProposalDoc {
  _id: Types.ObjectId;
  slug: string;
  title: string;
  track: Track;
  oneLiner: string;
  focus: string;
  prerequisites: string[];
  difficulty: 1 | 2 | 3;
  devRelevance: number;
  primarySources: PrimarySourceDoc[];
  rationale: string;
  status: ProposalStatus;
  createdAt: Date;
}

const ConceptProposalSchema = new Schema<ConceptProposalDoc>({
  slug: { type: String, required: true, index: true },
  title: { type: String, required: true },
  track: { type: String, required: true, enum: TRACKS },
  oneLiner: { type: String, required: true },
  focus: { type: String, required: true },
  prerequisites: { type: [String], required: true, default: [] },
  difficulty: { type: Number, required: true, min: 1, max: 3 },
  devRelevance: { type: Number, required: true, min: 0, max: 10 },
  primarySources: { type: [PrimarySourceSchema], required: true, default: [] },
  rationale: { type: String, required: true },
  status: { type: String, required: true, enum: PROPOSAL_STATUSES, default: 'pending', index: true },
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

/* ── model registration (idempotent under dev reload) ─────────────────────── */

function getModel<T>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

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
