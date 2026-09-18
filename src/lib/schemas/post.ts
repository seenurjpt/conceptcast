/**
 * Zod schemas for the post-generation collections. These are the persisted
 * shapes; LLM output schemas live next to their prompts.
 */
import { z } from 'zod';
import { mongo } from 'mongoose';
const { ObjectId } = mongo;
type ObjectId = mongo.ObjectId;

export const objectId = z.custom<ObjectId>((v) => v instanceof ObjectId, 'expected ObjectId');

/* ── users (BYO keys) ─────────────────────────────────────────────────────── */

export const EncryptedBlobSchema = z.object({ iv: z.string(), data: z.string(), tag: z.string(), v: z.literal(1) });

export const ProviderSchema = z.enum(['anthropic', 'openai']);
export type ProviderName = z.infer<typeof ProviderSchema>;

export const UserSchema = z.object({
  /** Stable user id (LinkedIn member URN for the signed-in author). */
  _id: z.string(),
  llm: z.object({
    preferredProvider: ProviderSchema.default('anthropic'),
    anthropicKey: EncryptedBlobSchema.nullable().default(null),
    openaiKey: EncryptedBlobSchema.nullable().default(null),
  }),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type UserDoc = z.infer<typeof UserSchema>;

/* ── voice_profiles ───────────────────────────────────────────────────────── */

export const VoiceProfileFieldsSchema = z.object({
  sentenceRhythm: z.string(),
  openingMoves: z.array(z.string()),
  hedgingVocabulary: z.string(),
  recurringReferences: z.array(z.string()),
  humorRegister: z.string(),
  bannedWords: z.array(z.string()),
  handlesUncertainty: z.string(),
  rawNotes: z.string(),
});
export type VoiceProfileFields = z.infer<typeof VoiceProfileFieldsSchema>;

export const VoiceProfileSchema = z.object({
  _id: objectId,
  userId: z.string(),
  version: z.number().int().min(1),
  createdAt: z.date(),
  sourceSampleIds: z.array(objectId),
  profile: VoiceProfileFieldsSchema,
  isActive: z.boolean(),
});
export type VoiceProfileDoc = z.infer<typeof VoiceProfileSchema>;

/* ── voice_samples ────────────────────────────────────────────────────────── */

export const VOICE_SOURCES = ['slack', 'pr', 'post', 'chat', 'other'] as const;
export const VoiceSampleSchema = z.object({
  _id: objectId,
  userId: z.string(),
  text: z.string().min(1),
  source: z.enum(VOICE_SOURCES),
  createdAt: z.date(),
});
export type VoiceSampleDoc = z.infer<typeof VoiceSampleSchema>;

/* ── archetypes ───────────────────────────────────────────────────────────── */

export const ARCHETYPE_SLUGS = [
  'concept-unpack',
  'myth-vs-reality',
  'build-log',
  'depth-ladder',
  'decision-framework',
  'post-mortem',
] as const;
export type ArchetypeSlug = (typeof ARCHETYPE_SLUGS)[number];
export const ArchetypeSlugSchema = z.enum(ARCHETYPE_SLUGS);
/** The one archetype that never needs first-hand evidence; the downgrade target. */
export const FALLBACK_ARCHETYPE: ArchetypeSlug = 'concept-unpack';

export const ArchetypeSlotSchema = z.object({
  slot: z.string(),
  guidance: z.string(),
  minChars: z.number().int().optional(),
  maxChars: z.number().int().optional(),
});

export const ArchetypeSchema = z.object({
  _id: objectId,
  slug: ArchetypeSlugSchema,
  name: z.string(),
  description: z.string(),
  structure: z.array(ArchetypeSlotSchema),
  hookPatterns: z.array(z.string()),
  suitableFor: z.array(z.string()),
  requiresFirsthandEvidence: z.boolean(),
});
export type ArchetypeDoc = z.infer<typeof ArchetypeSchema>;
export type ArchetypeSeed = Omit<ArchetypeDoc, '_id'>;

/* ── exemplars ────────────────────────────────────────────────────────────── */

export const ExemplarAnnotationsSchema = z.object({
  hook: z.string(),
  sections: z.record(z.string(), z.string()),
  whyItWorks: z.string(),
});

export const ExemplarSchema = z.object({
  _id: objectId,
  archetypeSlug: ArchetypeSlugSchema,
  authorHandle: z.string(),
  rawText: z.string().min(1),
  charCount: z.number().int(),
  annotations: ExemplarAnnotationsSchema,
  addedBy: z.string(),
  createdAt: z.date(),
});
export type ExemplarDoc = z.infer<typeof ExemplarSchema>;

/* ── angles ───────────────────────────────────────────────────────────────── */

export const AngleSchema = z.object({
  _id: objectId,
  runId: objectId,
  topicId: z.string(),
  claim: z.string(),
  archetypeSlug: ArchetypeSlugSchema,
  whoDisagrees: z.string(),
  concreteEvidence: z.array(z.string()),
  requiresAuthorInput: z.boolean(),
  score: z.number(),
  chosen: z.boolean(),
  /** Filled by verify-anchors (or copied from concreteEvidence when skipped). */
  verifiedAnchors: z.array(z.string()).optional(),
  unverifiableClaims: z.array(z.string()).optional(),
});
export type AngleDoc = z.infer<typeof AngleSchema>;

/* ── drafts ───────────────────────────────────────────────────────────────── */

export const FailureSchema = z.object({
  rule: z.string(),
  detail: z.string(),
  severity: z.enum(['error', 'warn']),
});
export type Failure = z.infer<typeof FailureSchema>;

export const DraftSectionsSchema = z.object({
  hook: z.string(),
  rehook: z.string(),
  context: z.string(),
  body: z.string(),
  takeaway: z.string(),
  cta: z.string(),
});
export type DraftSectionsShape = z.infer<typeof DraftSectionsSchema>;

export const DRAFT_STATUSES = ['generating', 'needs_author_input', 'ready', 'failed', 'approved', 'posted'] as const;
export const DraftStatusSchema = z.enum(DRAFT_STATUSES);
export type PostDraftStatus = z.infer<typeof DraftStatusSchema>;

export const CritiqueSchema = z.object({
  pass: z.boolean(),
  failures: z.array(FailureSchema),
  /** The LLM's notes, kept for the reviewer. */
  notes: z.array(z.string()).optional(),
  voiceMatch: z.number().optional(),
});
export type Critique = z.infer<typeof CritiqueSchema>;

export const PostDraftSchema = z.object({
  _id: objectId,
  runId: objectId,
  userId: z.string(),
  topicId: z.string(),
  angleId: objectId.nullable(),
  archetypeSlug: ArchetypeSlugSchema.nullable(),
  sections: DraftSectionsSchema,
  hashtags: z.array(z.string()),
  assembled: z.string(),
  charCount: z.number().int(),
  critique: CritiqueSchema.nullable(),
  revision: z.number().int(),
  status: DraftStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type PostDraftDoc = z.infer<typeof PostDraftSchema>;

/* ── generation_runs ──────────────────────────────────────────────────────── */

export const RUN_STATUSES = ['queued', 'running', 'needs_author_input', 'ready', 'failed'] as const;
export const RunStatusSchema = z.enum(RUN_STATUSES);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const GenerationRunSchema = z.object({
  _id: objectId,
  userId: z.string(),
  topicId: z.string(),
  status: RunStatusSchema,
  currentStage: z.string().nullable(),
  error: z.string().nullable(),
  stageResults: z.record(z.string(), z.unknown()),
  startedAt: z.date(),
  finishedAt: z.date().nullable(),
});
export type GenerationRunDoc = z.infer<typeof GenerationRunSchema>;

/* ── llm_calls ────────────────────────────────────────────────────────────── */

export const LlmCallSchema = z.object({
  _id: objectId,
  runId: z.string().nullable(),
  userId: z.string(),
  stage: z.string(),
  provider: ProviderSchema,
  model: z.string(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  latencyMs: z.number(),
  costUsd: z.number(),
  ok: z.boolean(),
  error: z.string().nullable(),
  at: z.date(),
});
export type LlmCallDoc = z.infer<typeof LlmCallSchema>;
