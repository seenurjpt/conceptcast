/**
 * Half 1 of the pipeline: resolve primary sources, run the researcher, store
 * the result. Split out of generate.ts so the research pool (lib/research)
 * can call it without a circular import; generate.ts re-exports it.
 */
import { Research, Topic, type ConceptDoc, type ResearchDoc, type TopicDoc } from '../db/models';
import { installUsageSink, setUsageConcept } from '../db/usageSink';
import { resolveSources } from '../sources/resolve';
import { runResearcher, dropMediumConfidence } from '../agents/researcher';
import { loadVoiceContext } from '../voice';

export type Log = (msg: string) => void;
const noop: Log = () => {};

/* ── half 1: sources + research ───────────────────────────────────────────── */

/** Main-topic context for the prompts; a legacy row without a topic falls back to its track. */
export async function withTopic(concept: ConceptDoc): Promise<ConceptDoc & { topicTitle?: string; topicDescription?: string }> {
  if (!concept.topicId) return concept;
  const t = await Topic.findById(concept.topicId).lean<TopicDoc>();
  return t ? { ...concept, topicTitle: t.title, topicDescription: t.description } : concept;
}

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
    // The researcher sees the main topic and the author's audience, so a
    // subtopic titled "Consistent hashing" is researched as system design
    // for that reader, not as an unlabelled phrase.
    const [meta, voice] = await Promise.all([withTopic(concept), loadVoiceContext()]);
    const research = await runResearcher(meta, resolved.sources, { audience: voice.audienceDescription });
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
