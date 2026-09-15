/**
 * Boxes 1–5 of the architecture: select → resolve sources → research → write
 * → critique. Runs Mon/Thu 06:00 (spec §2) and on demand via the
 * `pipeline/generate.requested` event.
 */
import { inngest, EVENTS, type GenerateRequestedData } from '../client';
import { dbConnect } from '@/lib/db/connect';
import { Concept, Research, type ConceptDoc, type ResearchDoc } from '@/lib/db/models';
import { selectNextConcept } from '@/lib/agents/selector';
import { claimConcept, researchConcept, draftFromResearch, settleConcept } from '@/lib/pipeline/generate';

const CRON = process.env.GENERATE_CRON ?? 'TZ=Asia/Kolkata 0 6 * * 1,4';

export const generatePost = inngest.createFunction(
  {
    id: 'generate-post',
    retries: 2,
    concurrency: [{ limit: 1 }],
    triggers: [{ cron: CRON }, { event: EVENTS.generateRequested }],
  },
  async ({ event, step, logger }) => {
    const requested = (event.name === EVENTS.generateRequested ? event.data : null) as GenerateRequestedData | null;

    // 1. Selector (or the explicitly requested concept).
    const selection = await step.run('select', async () => {
      await dbConnect();
      if (requested?.conceptId) {
        const c = await Concept.findById(requested.conceptId).lean<ConceptDoc>();
        if (!c) throw new Error(`Concept ${requested.conceptId} not found`);
        if (c.status === 'backlog') {
          const claimed = await claimConcept(c._id);
          return claimed ? { conceptId: String(claimed._id), slug: claimed.slug } : null;
        }
        if (requested.force && c.status !== 'retired') {
          await Concept.updateOne({ _id: c._id }, { $set: { status: 'selected', coveredAt: new Date(), note: null } });
          return { conceptId: String(c._id), slug: c.slug };
        }
        throw new Error(`Concept ${c.slug} is ${c.status}; not generating.`);
      }
      const result = await selectNextConcept();
      logger.info(`selector: ${result.eligible} eligible, top: ${result.ranked.slice(0, 3).map((r) => `${r.slug}=${r.total.toFixed(1)}`).join(', ')}`);
      if (!result.chosen) return null;
      const claimed = await claimConcept(result.chosen._id);
      return claimed ? { conceptId: String(claimed._id), slug: claimed.slug } : null;
    });
    if (!selection) return { skipped: true, reason: 'nothing eligible' };

    // 2 + 3. Source resolver + researcher.
    const researchId = await step.run('research', async () => {
      await dbConnect();
      const concept = await Concept.findById(selection.conceptId).lean<ConceptDoc>();
      if (!concept) throw new Error('concept vanished');
      try {
        const research = await researchConcept(concept, (m) => logger.info(m));
        return String(research._id);
      } catch (e) {
        await Concept.updateOne(
          { _id: concept._id, status: 'selected' },
          { $set: { status: 'backlog', coveredAt: null, note: `Research failed: ${(e as Error).message.slice(0, 500)}` } },
        );
        throw e;
      }
    });

    // 4 + 5. Writer + critic (+ one revision).
    const result = await step.run('write-and-critique', async () => {
      await dbConnect();
      const [concept, research] = await Promise.all([
        Concept.findById(selection.conceptId).lean<ConceptDoc>(),
        Research.findById(researchId).lean<ResearchDoc>(),
      ]);
      if (!concept || !research) throw new Error('concept or research vanished');
      try {
        const r = await draftFromResearch(concept, research, {
          angles: requested?.angle ? [requested.angle] : undefined,
          log: (m) => logger.info(m),
        });
        await settleConcept(concept, r);
        return { status: r.status, draftId: r.draftId, angle: r.angle, score: r.score, autoFails: r.autoFails };
      } catch (e) {
        await Concept.updateOne(
          { _id: concept._id, status: 'selected' },
          { $set: { status: 'backlog', coveredAt: null, note: `Drafting failed: ${(e as Error).message.slice(0, 500)}` } },
        );
        throw e;
      }
    });

    return { slug: selection.slug, ...result };
  },
);
