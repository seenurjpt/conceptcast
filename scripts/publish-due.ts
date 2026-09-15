/**
 * Publishes every scheduled publication whose time has come, and refreshes
 * the LinkedIn token if due. The same body the Inngest cron runs every 15
 * minutes — handy for a plain OS cron or a one-off.
 *
 *   npm run publish-due
 */
import { loadEnvLocal } from '../src/lib/loadEnv';
import { dbConnect, dbDisconnect } from '../src/lib/db/connect';
import { publishDuePublications } from '../src/lib/publishing';
import { refreshIfDue } from '../src/lib/publishers/linkedin';

async function main(): Promise<void> {
  loadEnvLocal();
  await dbConnect();
  const token = await refreshIfDue().catch((e: Error) => ({ state: 'error', refreshed: false, error: e.message }));
  console.log(`token: ${JSON.stringify(token)}`);
  const outcomes = await publishDuePublications(new Date());
  if (outcomes.length === 0) console.log('nothing due');
  for (const o of outcomes) {
    console.log(`${o.publicationId}: ${o.status}${o.postUrn ? ` ${o.postUrn}` : ''}${o.error ? ` — ${o.error}` : ''}`);
  }
  await dbDisconnect();
}

void main();
