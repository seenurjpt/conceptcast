/**
 * Seeds all 63 concepts from SPEC.md's appendix into Mongo and syncs indexes.
 *
 *   npx tsx scripts/seed.ts
 *
 * Validates the prerequisite DAG first (throws on a cycle or dangling slug).
 * Re-running is safe: concept metadata is updated in place, but pipeline
 * state (status, coveredAt, devRelevance, timelinessBoost) is never clobbered.
 */
import { loadEnvLocal } from '../src/lib/loadEnv';
import { SEED_CONCEPTS } from '../src/lib/concepts/seed';
import { validateDag } from '../src/lib/concepts/dag';
import { dbConnect, dbDisconnect } from '../src/lib/db/connect';
import { Concept, syncAllIndexes } from '../src/lib/db/models';

async function main(): Promise<void> {
  loadEnvLocal();

  const order = validateDag(SEED_CONCEPTS);
  console.log(`DAG valid: ${SEED_CONCEPTS.length} concepts, topological order OK.`);
  console.log(`  first publishable: ${order.slice(0, 5).join(', ')}, ...`);

  await dbConnect();

  const result = await Concept.bulkWrite(
    SEED_CONCEPTS.map((c) => ({
      updateOne: {
        filter: { slug: c.slug },
        update: {
          $set: {
            title: c.title,
            track: c.track,
            oneLiner: c.oneLiner,
            focus: c.focus,
            prerequisites: c.prerequisites,
            difficulty: c.difficulty,
            primarySources: c.primarySources,
          },
          $setOnInsert: {
            slug: c.slug,
            devRelevance: c.devRelevance,
            status: 'backlog',
            coveredAt: null,
            publishedDraftId: null,
            timelinessBoost: 0,
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    })),
  );
  console.log(
    `Seeded concepts: ${result.upsertedCount} inserted, ${result.modifiedCount} updated, ` +
      `${SEED_CONCEPTS.length - result.upsertedCount - result.modifiedCount} unchanged.`,
  );

  await syncAllIndexes();
  console.log('Indexes synced (concepts.slug unique, concepts.status+track, drafts.status, publications.scheduledFor).');

  const byTrack = await Concept.aggregate<{ _id: string; n: number }>([
    { $group: { _id: '$track', n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const total = byTrack.reduce((s, t) => s + t.n, 0);
  console.log(`Backlog now holds ${total} concepts: ${byTrack.map((t) => `${t._id}=${t.n}`).join(', ')}`);

  await dbDisconnect();
}

main().catch((e) => {
  console.error(`Seed failed: ${(e as Error).message}`);
  process.exitCode = 1;
  void dbDisconnect();
});
