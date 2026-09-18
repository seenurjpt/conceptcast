/**
 * Typed accessors for the post-generation collections. No ODM: these are
 * plain driver collections reached through the existing mongoose connection,
 * validated by the zod schemas in lib/schemas at the write boundary.
 *
 * Note: the legacy pipeline's mongoose `Draft` model already owns the
 * `drafts` collection, so the new drafts live in `post_drafts`.
 */
import mongoose, { mongo } from 'mongoose';
const { ObjectId } = mongo;
type ObjectId = mongo.ObjectId;
type Collection<T extends { _id: unknown }> = mongo.Collection<T>;
type Db = mongo.Db;
type Filter<T> = mongo.Filter<T>;
type ClientSession = mongo.ClientSession;
import { dbConnect } from './connect';
import {
  UserSchema,
  VoiceProfileSchema,
  VoiceSampleSchema,
  ArchetypeSchema,
  ExemplarSchema,
  AngleSchema,
  PostDraftSchema,
  GenerationRunSchema,
  LlmCallSchema,
  type UserDoc,
  type VoiceProfileDoc,
  type VoiceProfileFields,
  type VoiceSampleDoc,
  type ArchetypeDoc,
  type ArchetypeSeed,
  type ExemplarDoc,
  type AngleDoc,
  type PostDraftDoc,
  type GenerationRunDoc,
  type LlmCallDoc,
  type PostDraftStatus,
  type RunStatus,
} from '../schemas/post';

export const COLLECTIONS = {
  users: 'users',
  voiceProfiles: 'voice_profiles',
  voiceSamples: 'voice_samples',
  archetypes: 'archetypes',
  exemplars: 'exemplars',
  angles: 'angles',
  drafts: 'post_drafts',
  generationRuns: 'generation_runs',
  llmCalls: 'llm_calls',
} as const;

export async function getDb(): Promise<Db> {
  const m = await dbConnect();
  const db = m.connection.db;
  if (!db) throw new Error('Mongo connection has no db handle.');
  return db as unknown as Db;
}

async function col<T extends { _id: unknown }>(name: string): Promise<Collection<T>> {
  return (await getDb()).collection<T>(name);
}

export const oid = (id: string | ObjectId): ObjectId => (id instanceof ObjectId ? id : new ObjectId(id));

/* ── users ────────────────────────────────────────────────────────────────── */

export const users = {
  async get(userId: string): Promise<UserDoc | null> {
    return (await col<UserDoc>(COLLECTIONS.users)).findOne({ _id: userId });
  },
  async ensure(userId: string): Promise<UserDoc> {
    const c = await col<UserDoc>(COLLECTIONS.users);
    const now = new Date();
    const doc = UserSchema.parse({
      _id: userId,
      llm: { preferredProvider: 'anthropic', anthropicKey: null, openaiKey: null },
      createdAt: now,
      updatedAt: now,
    });
    await c.updateOne({ _id: userId }, { $setOnInsert: doc }, { upsert: true });
    return (await c.findOne({ _id: userId })) as UserDoc;
  },
  async setLlm(userId: string, llm: Partial<UserDoc['llm']>): Promise<void> {
    await this.ensure(userId);
    const $set: Record<string, unknown> = { updatedAt: new Date() };
    for (const [k, v] of Object.entries(llm)) $set['llm.' + k] = v;
    await (await col<UserDoc>(COLLECTIONS.users)).updateOne({ _id: userId }, { $set });
  },
};

/* ── voice_profiles ───────────────────────────────────────────────────────── */

export const voiceProfiles = {
  async active(userId: string): Promise<VoiceProfileDoc | null> {
    return (await col<VoiceProfileDoc>(COLLECTIONS.voiceProfiles)).findOne({ userId, isActive: true });
  },
  async list(userId: string): Promise<VoiceProfileDoc[]> {
    return (await col<VoiceProfileDoc>(COLLECTIONS.voiceProfiles)).find({ userId }).sort({ version: -1 }).toArray();
  },
  /**
   * Creates version+1 and flips isActive in one transaction so there is never
   * zero or two active profiles. Falls back to sequential writes on a
   * standalone server (transactions need a replica set).
   */
  async createVersion(userId: string, profile: VoiceProfileFields, sourceSampleIds: ObjectId[]): Promise<VoiceProfileDoc> {
    const c = await col<VoiceProfileDoc>(COLLECTIONS.voiceProfiles);
    const write = async (session?: ClientSession): Promise<VoiceProfileDoc> => {
      const latest = await c.find({ userId }, { session }).sort({ version: -1 }).limit(1).next();
      const doc = VoiceProfileSchema.parse({
        _id: new ObjectId(),
        userId,
        version: (latest?.version ?? 0) + 1,
        createdAt: new Date(),
        sourceSampleIds,
        profile,
        isActive: true,
      });
      await c.updateMany({ userId, isActive: true }, { $set: { isActive: false } }, { session });
      await c.insertOne(doc, { session });
      return doc;
    };
    const client = mongoose.connection.getClient();
    const session = client.startSession();
    try {
      let out: VoiceProfileDoc | null = null;
      await session.withTransaction(async () => {
        out = await write(session);
      });
      return out as unknown as VoiceProfileDoc;
    } catch (e) {
      const msg = (e as Error).message ?? '';
      if (/Transaction numbers are only allowed|replica set/i.test(msg)) return write();
      throw e;
    } finally {
      await session.endSession();
    }
  },
};

/* ── voice_samples ────────────────────────────────────────────────────────── */

export const voiceSamples = {
  async insert(doc: Omit<VoiceSampleDoc, '_id' | 'createdAt'>): Promise<VoiceSampleDoc> {
    const full = VoiceSampleSchema.parse({ ...doc, _id: new ObjectId(), createdAt: new Date() });
    await (await col<VoiceSampleDoc>(COLLECTIONS.voiceSamples)).insertOne(full);
    return full;
  },
  async list(userId: string): Promise<VoiceSampleDoc[]> {
    return (await col<VoiceSampleDoc>(COLLECTIONS.voiceSamples)).find({ userId }).sort({ createdAt: 1 }).toArray();
  },
  async count(userId: string): Promise<number> {
    return (await col<VoiceSampleDoc>(COLLECTIONS.voiceSamples)).countDocuments({ userId });
  },
};

/* ── archetypes ───────────────────────────────────────────────────────────── */

export const archetypes = {
  async get(slug: string): Promise<ArchetypeDoc | null> {
    return (await col<ArchetypeDoc>(COLLECTIONS.archetypes)).findOne({ slug } as Filter<ArchetypeDoc>);
  },
  async list(): Promise<ArchetypeDoc[]> {
    return (await col<ArchetypeDoc>(COLLECTIONS.archetypes)).find({}).sort({ slug: 1 }).toArray();
  },
  async upsert(seed: ArchetypeSeed): Promise<void> {
    const c = await col<ArchetypeDoc>(COLLECTIONS.archetypes);
    ArchetypeSchema.omit({ _id: true }).parse(seed);
    await c.updateOne(
      { slug: seed.slug } as Filter<ArchetypeDoc>,
      { $set: seed, $setOnInsert: { _id: new ObjectId() } },
      { upsert: true },
    );
  },
};

/* ── exemplars ────────────────────────────────────────────────────────────── */

export const exemplars = {
  async insert(doc: Omit<ExemplarDoc, '_id' | 'createdAt'>): Promise<ExemplarDoc> {
    const full = ExemplarSchema.parse({ ...doc, _id: new ObjectId(), createdAt: new Date() });
    await (await col<ExemplarDoc>(COLLECTIONS.exemplars)).insertOne(full);
    return full;
  },
  async forArchetype(archetypeSlug: string): Promise<ExemplarDoc[]> {
    return (await col<ExemplarDoc>(COLLECTIONS.exemplars))
      .find({ archetypeSlug } as Filter<ExemplarDoc>)
      .sort({ createdAt: 1 })
      .toArray();
  },
  async list(): Promise<ExemplarDoc[]> {
    return (await col<ExemplarDoc>(COLLECTIONS.exemplars)).find({}).sort({ archetypeSlug: 1, createdAt: -1 }).toArray();
  },
  async countByArchetype(): Promise<Record<string, number>> {
    const rows = await (await col<ExemplarDoc>(COLLECTIONS.exemplars))
      .aggregate<{ _id: string; n: number }>([{ $group: { _id: '$archetypeSlug', n: { $sum: 1 } } }])
      .toArray();
    return Object.fromEntries(rows.map((r) => [r._id, r.n]));
  },
  async remove(id: string): Promise<boolean> {
    const r = await (await col<ExemplarDoc>(COLLECTIONS.exemplars)).deleteOne({ _id: oid(id) });
    return r.deletedCount === 1;
  },
};

/* ── angles ───────────────────────────────────────────────────────────────── */

export const angles = {
  async insertMany(docs: Omit<AngleDoc, '_id'>[]): Promise<AngleDoc[]> {
    const full = docs.map((d) => AngleSchema.parse({ ...d, _id: new ObjectId() }));
    if (full.length) await (await col<AngleDoc>(COLLECTIONS.angles)).insertMany(full);
    return full;
  },
  async get(id: string | ObjectId): Promise<AngleDoc | null> {
    return (await col<AngleDoc>(COLLECTIONS.angles)).findOne({ _id: oid(id) });
  },
  async update(id: string | ObjectId, patch: Partial<Omit<AngleDoc, '_id'>>): Promise<void> {
    await (await col<AngleDoc>(COLLECTIONS.angles)).updateOne({ _id: oid(id) }, { $set: patch });
  },
  async byIds(ids: ObjectId[]): Promise<AngleDoc[]> {
    if (ids.length === 0) return [];
    return (await col<AngleDoc>(COLLECTIONS.angles)).find({ _id: { $in: ids } }).toArray();
  },
};

/* ── drafts ───────────────────────────────────────────────────────────────── */

export const postDrafts = {
  async insert(doc: Omit<PostDraftDoc, '_id' | 'createdAt' | 'updatedAt'>): Promise<PostDraftDoc> {
    const now = new Date();
    const full = PostDraftSchema.parse({ ...doc, _id: new ObjectId(), createdAt: now, updatedAt: now });
    await (await col<PostDraftDoc>(COLLECTIONS.drafts)).insertOne(full);
    return full;
  },
  async get(id: string | ObjectId): Promise<PostDraftDoc | null> {
    return (await col<PostDraftDoc>(COLLECTIONS.drafts)).findOne({ _id: oid(id) });
  },
  async update(
    id: string | ObjectId,
    patch: Partial<Omit<PostDraftDoc, '_id' | 'createdAt'>>,
  ): Promise<PostDraftDoc | null> {
    const c = await col<PostDraftDoc>(COLLECTIONS.drafts);
    return c.findOneAndUpdate({ _id: oid(id) }, { $set: { ...patch, updatedAt: new Date() } }, { returnDocument: 'after' });
  },
  async forRun(runId: string | ObjectId): Promise<PostDraftDoc | null> {
    return (await col<PostDraftDoc>(COLLECTIONS.drafts))
      .find({ runId: oid(runId) })
      .sort({ revision: -1, createdAt: -1 })
      .limit(1)
      .next();
  },
  async recent(userId: string, limit: number, statuses?: PostDraftStatus[]): Promise<PostDraftDoc[]> {
    const filter: Filter<PostDraftDoc> = statuses ? { userId, status: { $in: statuses } } : { userId };
    return (await col<PostDraftDoc>(COLLECTIONS.drafts)).find(filter).sort({ createdAt: -1 }).limit(limit).toArray();
  },
  async page(
    userId: string,
    opts: { status?: PostDraftStatus; page: number; limit: number },
  ): Promise<{ items: PostDraftDoc[]; total: number }> {
    const c = await col<PostDraftDoc>(COLLECTIONS.drafts);
    const filter: Filter<PostDraftDoc> = opts.status ? { userId, status: opts.status } : { userId };
    const [items, total] = await Promise.all([
      c
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((opts.page - 1) * opts.limit)
        .limit(opts.limit)
        .toArray(),
      c.countDocuments(filter),
    ]);
    return { items, total };
  },
  async countByStatus(userId: string, status: PostDraftStatus): Promise<number> {
    return (await col<PostDraftDoc>(COLLECTIONS.drafts)).countDocuments({ userId, status });
  },
};

/* ── generation_runs ──────────────────────────────────────────────────────── */

export const generationRuns = {
  async create(userId: string, topicId: string): Promise<GenerationRunDoc> {
    const doc = GenerationRunSchema.parse({
      _id: new ObjectId(),
      userId,
      topicId,
      status: 'queued',
      currentStage: null,
      error: null,
      stageResults: {},
      startedAt: new Date(),
      finishedAt: null,
    });
    await (await col<GenerationRunDoc>(COLLECTIONS.generationRuns)).insertOne(doc);
    return doc;
  },
  async get(id: string | ObjectId): Promise<GenerationRunDoc | null> {
    return (await col<GenerationRunDoc>(COLLECTIONS.generationRuns)).findOne({ _id: oid(id) });
  },
  async update(
    id: string | ObjectId,
    patch: { status?: RunStatus; currentStage?: string | null; error?: string | null; finishedAt?: Date | null },
    stageResult?: { stage: string; result: unknown },
  ): Promise<void> {
    const $set: Record<string, unknown> = { ...patch };
    if (stageResult) $set['stageResults.' + stageResult.stage] = stageResult.result;
    await (await col<GenerationRunDoc>(COLLECTIONS.generationRuns)).updateOne({ _id: oid(id) }, { $set });
  },
};

/* ── llm_calls ────────────────────────────────────────────────────────────── */

export const llmCalls = {
  async insert(doc: Omit<LlmCallDoc, '_id' | 'at'>): Promise<void> {
    const full = LlmCallSchema.parse({ ...doc, _id: new ObjectId(), at: new Date() });
    await (await col<LlmCallDoc>(COLLECTIONS.llmCalls)).insertOne(full);
  },
};

/* ── indexes ──────────────────────────────────────────────────────────────── */

export async function ensurePostIndexes(): Promise<void> {
  const db = await getDb();
  await Promise.all([
    db.collection(COLLECTIONS.exemplars).createIndex({ archetypeSlug: 1 }),
    db.collection(COLLECTIONS.archetypes).createIndex({ slug: 1 }, { unique: true }),
    db.collection(COLLECTIONS.voiceProfiles).createIndex({ userId: 1, isActive: 1 }),
    db.collection(COLLECTIONS.voiceProfiles).createIndex({ userId: 1, version: 1 }, { unique: true }),
    db.collection(COLLECTIONS.voiceSamples).createIndex({ userId: 1, createdAt: 1 }),
    db.collection(COLLECTIONS.angles).createIndex({ runId: 1 }),
    db.collection(COLLECTIONS.drafts).createIndex({ userId: 1, status: 1, createdAt: -1 }),
    db.collection(COLLECTIONS.drafts).createIndex({ runId: 1 }),
    db.collection(COLLECTIONS.generationRuns).createIndex({ userId: 1, startedAt: -1 }),
    db.collection(COLLECTIONS.llmCalls).createIndex({ runId: 1 }),
  ]);
}
