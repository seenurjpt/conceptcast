/**
 * Dev-only: smoke-tests scripts/seed.ts and the Mongoose models against an
 * in-memory MongoDB (no local mongod needed).
 *
 *   npx tsx scripts/smoke-db.ts
 */
import { spawnSync } from 'node:child_process';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

async function main(): Promise<void> {
  const mem = await MongoMemoryServer.create();
  const uri = `${mem.getUri()}conceptcast`;
  console.log(`in-memory mongod at ${uri}`);

  // Run the real seed script twice (second run must be an idempotent upsert).
  for (const run of [1, 2]) {
    const r = spawnSync('npx', ['tsx', 'scripts/seed.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, MONGODB_URI: uri },
      encoding: 'utf8',
      shell: true,
    });
    console.log(`--- seed run ${run} (exit ${r.status}) ---\n${r.stdout}${r.stderr}`);
    if (r.status !== 0) throw new Error(`seed run ${run} failed`);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) throw new Error('no db handle');

  const count = await db.collection('concepts').countDocuments();
  console.log(`concepts count: ${count}`);
  if (count !== 63) throw new Error(`expected 63 concepts, got ${count}`);

  const names = async (coll: string): Promise<string> =>
    (await db.collection(coll).indexes()).map((i) => JSON.stringify(i.key)).join(' ');
  console.log('concepts indexes:', await names('concepts'));
  console.log('drafts indexes:', await names('drafts'));
  console.log('publications indexes:', await names('publications'));

  const kv = await db.collection('concepts').findOne({ slug: 'kv-cache' });
  console.log(
    'kv-cache doc:',
    JSON.stringify({
      track: kv?.track,
      status: kv?.status,
      difficulty: kv?.difficulty,
      prerequisites: kv?.prerequisites,
      sources: kv?.primarySources?.length,
    }),
  );

  // Unknown-slug path of draft.ts must list seeded slugs and exit 1 before any API call.
  const d = spawnSync('npx', ['tsx', 'scripts/draft.ts', 'no-such-concept'], {
    cwd: process.cwd(),
    env: { ...process.env, MONGODB_URI: uri, ANTHROPIC_API_KEY: 'unused' },
    encoding: 'utf8',
    shell: true,
  });
  const listsSlugs = d.stderr.includes('kv-cache') && d.stderr.includes('Unknown slug');
  console.log(`draft.ts unknown-slug: exit ${d.status}, lists seeded slugs: ${listsSlugs}`);
  if (d.status !== 1 || !listsSlugs) throw new Error('draft.ts unknown-slug path misbehaved');

  await mongoose.disconnect();
  await mem.stop();
  console.log('\nSMOKE TEST PASSED');
}

main().catch((e) => {
  console.error(`SMOKE TEST FAILED: ${(e as Error).message}`);
  process.exit(1);
});
