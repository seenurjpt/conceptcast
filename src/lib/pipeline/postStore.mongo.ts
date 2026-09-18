/**
 * PipelineStore backed by Mongo. Topics are the existing `Concept` docs; the
 * DAG ancestors are resolved through `prerequisites` (slugs) recursively.
 */
import { Concept, type ConceptDoc } from '../db/models';
import { angles, archetypes, exemplars, generationRuns, oid, postDrafts, voiceProfiles } from '../db/collections';
import type { PipelineStore, StoredAngle, StoredDraftInput, TopicInput } from './postPipeline';
import type { AngleDoc } from '../schemas/post';

type ConceptLite = Pick<ConceptDoc, '_id' | 'slug' | 'title' | 'track' | 'oneLiner' | 'focus' | 'prerequisites'>;

async function ancestorTitles(root: ConceptLite): Promise<string[]> {
  const seen = new Set<string>([root.slug]);
  const titles: string[] = [];
  let frontier = [...root.prerequisites];
  while (frontier.length) {
    const slugs = frontier.filter((s) => !seen.has(s));
    if (slugs.length === 0) break;
    slugs.forEach((s) => seen.add(s));
    const docs = await Concept.find({ slug: { $in: slugs } })
      .select({ slug: 1, title: 1, prerequisites: 1 })
      .lean<Pick<ConceptDoc, 'slug' | 'title' | 'prerequisites'>[]>();
    titles.push(...docs.map((d) => d.title));
    frontier = docs.flatMap((d) => d.prerequisites);
  }
  return titles;
}

function toStored(a: AngleDoc): StoredAngle {
  return {
    id: String(a._id),
    claim: a.claim,
    archetypeSlug: a.archetypeSlug,
    whoDisagrees: a.whoDisagrees,
    concreteEvidence: a.concreteEvidence,
    requiresAuthorInput: a.requiresAuthorInput,
    score: a.score,
    chosen: a.chosen,
    verifiedAnchors: a.verifiedAnchors,
  };
}

export const mongoPostStore: PipelineStore = {
  async getTopic(topicId): Promise<TopicInput | null> {
    if (!/^[0-9a-f]{24}$/i.test(topicId)) return null;
    const c = await Concept.findById(topicId)
      .select({ slug: 1, title: 1, track: 1, oneLiner: 1, focus: 1, prerequisites: 1 })
      .lean<ConceptLite | null>();
    if (!c) return null;
    return {
      id: String(c._id),
      title: c.title,
      content: `${c.oneLiner}\n\n${c.focus}`,
      tags: [c.track],
      ancestorTitles: await ancestorTitles(c),
    };
  },

  async recentClaims(userId, limit) {
    const drafts = await postDrafts.recent(userId, limit);
    const ids = drafts.map((d) => d.angleId).filter((x): x is NonNullable<typeof x> => x !== null);
    const found = await angles.byIds(ids);
    const byId = new Map(found.map((a) => [String(a._id), a.claim]));
    return ids.map((id) => byId.get(String(id))).filter((c): c is string => Boolean(c));
  },

  async recentArchetypes(userId, limit) {
    const drafts = await postDrafts.recent(userId, limit, ['ready', 'approved', 'posted']);
    return drafts.map((d) => d.archetypeSlug).filter((s): s is NonNullable<typeof s> => s !== null);
  },

  async insertAngles(runId, topicId, list) {
    const docs = await angles.insertMany(
      list.map((a) => ({
        runId: oid(runId),
        topicId,
        claim: a.claim,
        archetypeSlug: a.archetypeSlug,
        whoDisagrees: a.whoDisagrees,
        concreteEvidence: a.concreteEvidence,
        requiresAuthorInput: a.requiresAuthorInput,
        score: a.score,
        chosen: a.chosen,
      })),
    );
    return docs.map(toStored);
  },

  async getAngle(id) {
    const a = await angles.get(id);
    return a ? toStored(a) : null;
  },

  async updateAngle(id, patch) {
    await angles.update(id, patch as Partial<AngleDoc>);
  },

  async activeVoiceProfile(userId) {
    const p = await voiceProfiles.active(userId);
    return p?.profile ?? null;
  },

  async getArchetype(slug) {
    return archetypes.get(slug);
  },

  async exemplarsFor(slug) {
    return (await exemplars.forArchetype(slug)).map((e) => e.rawText);
  },

  async insertDraft(d: StoredDraftInput) {
    const doc = await postDrafts.insert({
      runId: oid(d.runId),
      userId: d.userId,
      topicId: d.topicId,
      angleId: d.angleId ? oid(d.angleId) : null,
      archetypeSlug: d.archetypeSlug,
      sections: d.sections,
      hashtags: d.hashtags,
      assembled: d.assembled,
      charCount: d.charCount,
      critique: d.critique,
      revision: d.revision,
      status: d.status,
    });
    return String(doc._id);
  },

  async getDraft(id) {
    const d = await postDrafts.get(id);
    return d ? { sections: d.sections, hashtags: d.hashtags, assembled: d.assembled, charCount: d.charCount } : null;
  },

  async updateDraft(id, patch) {
    const { angleId, ...rest } = patch;
    await postDrafts.update(id, { ...rest, ...(angleId !== undefined ? { angleId: angleId ? oid(angleId) : null } : {}) });
  },

  async updateRun(runId, patch, stageResult) {
    await generationRuns.update(runId, patch, stageResult);
  },
};
