/**
 * Runs the optional timeliness scan once: decay yesterday's boosts, fetch
 * feeds, ask Haiku which backlog concepts the headlines relate to.
 *
 *   npm run timeliness
 */
import { loadEnvLocal } from '../src/lib/loadEnv';
import { dbConnect, dbDisconnect } from '../src/lib/db/connect';
import { installUsageSink } from '../src/lib/db/usageSink';
import { decayTimelinessBoosts, scanTimeliness } from '../src/lib/concepts/timeliness';

async function main(): Promise<void> {
  loadEnvLocal();
  await dbConnect();
  installUsageSink();
  const decayed = await decayTimelinessBoosts();
  console.log(`decayed ${decayed} boost(s)`);
  const scan = await scanTimeliness((m) => console.log(m));
  console.log(JSON.stringify(scan, null, 2));
  await dbDisconnect();
}

void main();
