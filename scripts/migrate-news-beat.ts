/**
 * One-off migration to the AI-driven-development beat.
 *
 *   npm run migrate:news-beat
 *
 * 1. Retires every backlog/selected concept whose track is not in the new
 *    TRACKS list (the old model-internals seed). Retired, not deleted: drafts,
 *    publications and analytics keep their references and history.
 * 2. Upserts the new evergreen seed (same rules as scripts/seed.ts).
 * 3. Syncs indexes.
 *
 * Re-running is safe. Pass --dry-run to see counts without writing.
 */
import { loadEnvLocal } from '../src/lib/loadEnv';
import { SEED_CONCEPTS, TRACKS } from '../src/lib/concepts/seed';
import { validateDag } from '../src/lib/concepts/dag';
import { dbConnect, dbDisconnect } from '../src/lib/db/connect';
import { Concept, syncAllIndexes } from '../src/lib/db/models';

const DRY = process.argv.includes('--dry-run');
const RETIRE_NOTE = 'Retired 2026-09-18: the model-internals beat was replaced by AI-driven development.';

async function main(): Promise<void> {
  loadEnvLocal();
  validateDag(SEED_CONCEPTS);
  await dbConnect();

  const stale = { track: { $nin: [...TRACKS] }, status: { $in: ['backlog', 'selected'] as ('backlog' | 'selected')[] } };
  const staleCount = await Concept.countDocuments(stale);
  console.log(`${staleCount} concept(s) on old tracks still in the backlog${DRY ? ' (dry run, not retiring)' : ''}.`);
  if (!DRY && staleCount) {
    const r = await Concept.updateMany(stale, { $set: { status: 'retired', note: RETIRE_NOTE, timelinessBoost: 0 } });
    console.log(`Retired ${r.modifiedCount}.`);
  }

  if (!DRY) {
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
              origin: 'seed',
            },
            $setOnInsert: {
              slug: c.slug,
              devRelevance: c.devRelevance,
              status: 'backlog',
              coveredAt: null,
              publishedDraftId: null,
              timelinessBoost: 0,
              note: null,
              storyDate: null,
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      })),
    );
    console.log(`Seeded new beat: ${result.upsertedCount} inserted, ${result.modifiedCount} updated.`);
    await syncAllIndexes();
  } else {
    console.log(`Would upsert ${SEED_CONCEPTS.length} evergreen concepts.`);
  }

  const byTrack = await Concept.aggregate<{ _id: string; n: number }>([
    { $match: { status: 'backlog' } },
    { $group: { _id: '$track', n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  console.log(`Backlog now: ${byTrack.map((t) => `${t._id}=${t.n}`).join(', ') || '(empty)'}`);
  console.log('Next: npm run news:scan (or wait for the 07:00 job) to fill the queue from the feeds.');
  await dbDisconnect();
}

main().catch((e) => {
  console.error(`Migration failed: ${(e as Error).message}`);
  process.exitCode = 1;
  void dbDisconnect();
});
