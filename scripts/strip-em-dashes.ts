/**
 * One-off cleanup: rewrites em dashes in text the app already stored, using
 * the same rules as the live guard on model replies (src/lib/noEmDash.ts).
 *
 *   npm run strip-em-dashes -- --dry-run   # counts only
 *   npm run strip-em-dashes                # rewrite
 *
 * Covers the content collections the dashboard shows. Skips:
 *   - drafts already published, and publications: that text is live on
 *     LinkedIn, and the local copy should keep matching what went out;
 *   - logs, tokens and keys (usage, llm_calls, LinkedIn auth, users).
 *
 * Re-running is safe: a document without an em dash is never written.
 */
import mongoose from 'mongoose';
import { loadEnvLocal } from '../src/lib/loadEnv';
import { dbConnect, dbDisconnect } from '../src/lib/db/connect';
import { hasEmDash, stripEmDashesDeep } from '../src/lib/noEmDash';

const DRY = process.argv.includes('--dry-run');

const SKIP = /^(usages?|llm_?calls|linkedinauths?|users|publications|system\.)/i;

function containsEmDash(value: unknown): boolean {
  if (typeof value === 'string') return hasEmDash(value);
  if (Array.isArray(value)) return value.some(containsEmDash);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.values(value).some(containsEmDash);
  }
  return false;
}

async function main(): Promise<void> {
  loadEnvLocal();
  await dbConnect();
  const db = mongoose.connection.db;
  if (!db) throw new Error('No database handle after connect.');

  const names = (await db.listCollections().toArray()).map((c) => c.name).sort();
  let totalDocs = 0;
  for (const name of names) {
    if (SKIP.test(name)) continue;
    const col = db.collection(name);
    let docs = 0;
    for await (const doc of col.find({})) {
      if (name === 'drafts' && doc.status === 'published') continue;
      const { _id, ...rest } = doc;
      const dirty = Object.entries(rest).filter(([, v]) => containsEmDash(v));
      if (dirty.length === 0) continue;
      docs++;
      if (!DRY) {
        const $set = Object.fromEntries(dirty.map(([k, v]) => [k, stripEmDashesDeep(v)]));
        await col.updateOne({ _id }, { $set });
      }
    }
    if (docs) console.log(`${name.padEnd(24)} ${docs} document(s)${DRY ? ' would change' : ' cleaned'}`);
    totalDocs += docs;
  }
  console.log(totalDocs ? `${DRY ? 'Would clean' : 'Cleaned'} ${totalDocs} document(s).` : 'No em dashes found.');
  await dbDisconnect();
}

main().catch(async (e: unknown) => {
  console.error(e);
  await dbDisconnect().catch(() => undefined);
  process.exit(1);
});
