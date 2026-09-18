/**
 * Run the daily news scan from the CLI.
 *
 *   npm run news:scan               # fetch feeds, cluster, propose, print the result
 *   npm run news:scan -- --dry-run  # fetch and cluster only; no model call, no writes
 */
import { loadEnvLocal } from '../src/lib/loadEnv';
import { dbConnect, dbDisconnect } from '../src/lib/db/connect';
import { fetchBeatItems } from '../src/lib/news/feeds';
import { clusterItems } from '../src/lib/news/cluster';
import { expireNewsProposals, proposeFromNews } from '../src/lib/news/propose';

const DRY = process.argv.includes('--dry-run');

async function main(): Promise<void> {
  loadEnvLocal();
  if (DRY) {
    const { scanned, items } = await fetchBeatItems();
    console.log(`${scanned} feed items, ${items.length} on the beat`);
    for (const c of clusterItems(items).slice(0, 15)) {
      console.log(`\n[${c.score}] ${c.headline}`);
      for (const i of c.items) console.log(`    ${i.publishedAt?.toISOString().slice(0, 10) ?? '----------'}  ${i.link}`);
    }
    return;
  }
  await dbConnect();
  const expired = await expireNewsProposals();
  if (expired) console.log(`expired ${expired} stale proposal(s)`);
  const scan = await proposeFromNews((m) => console.log(m));
  console.log(`\n${scan.proposed.length} proposed, ${scan.dropped.length} dropped`);
  for (const d of scan.dropped) console.log(`  drop: ${d.headline} (${d.reason})`);
  await dbDisconnect();
}

main().catch((e) => {
  console.error(`News scan failed: ${(e as Error).message}`);
  process.exitCode = 1;
  void dbDisconnect();
});
