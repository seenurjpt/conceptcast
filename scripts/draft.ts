/**
 * CLI pipeline: sources -> research -> write -> critique (-> one revision).
 *
 *   npm run draft -- <slug> [more-slugs...] [--angle mechanism|misconception|tradeoff|debug-story] [--force]
 *
 * Same code path as the dashboard and the Inngest cron (src/lib/pipeline/generate.ts).
 * A passing draft lands in the review queue as 'pending'; a dead one is stored as
 * 'rejected' and the concept returns to the backlog with a note. The full run
 * artifact is also written to data/drafts/<slug>.json for prompt iteration.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadEnvLocal } from '../src/lib/loadEnv';
import { dbConnect, dbDisconnect } from '../src/lib/db/connect';
import { Concept } from '../src/lib/db/models';
import { generateForConcept, type DraftRunResult } from '../src/lib/pipeline/generate';
import { ANGLES, type Angle } from '../src/lib/schemas';

function printResult(r: DraftRunResult): void {
  const bar = '─'.repeat(72);
  console.log(`\n${bar}`);
  console.log(
    `${r.conceptSlug}  |  ${r.status.toUpperCase()}  |  angle: ${r.angle}  |  score: ${r.score}/10  |  ${r.body.length} chars${r.revised ? '  |  revised' : ''}`,
  );
  console.log(bar);
  console.log(r.body);
  console.log(bar);
  if (r.autoFails.length) console.log(`auto-fails: ${r.autoFails.join(', ')}`);
  if (r.constraintViolations.length) {
    console.log(`constraint violations:\n${r.constraintViolations.map((v) => `  - ${v}`).join('\n')}`);
  }
  if (r.issues.length) console.log(`critic issues:\n${r.issues.map((i) => `  - ${i}`).join('\n')}`);
  console.log(
    r.status === 'dead'
      ? 'status: DEAD — draft stored as rejected, concept returned to backlog.'
      : `status: PENDING — draft ${r.draftId} awaits review at http://localhost:3000/review`,
  );
}

async function main(): Promise<void> {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const angleIdx = args.indexOf('--angle');
  const angle = angleIdx !== -1 ? (args[angleIdx + 1] as Angle) : undefined;
  if (angle && !(ANGLES as readonly string[]).includes(angle)) {
    console.error(`Unknown angle "${angle}". One of: ${ANGLES.join(', ')}`);
    process.exit(1);
  }
  const slugs = args.filter((a, i) => !a.startsWith('--') && (angleIdx === -1 || i !== angleIdx + 1));
  if (slugs.length === 0) {
    console.error('Usage: npm run draft -- <concept-slug> [more-slugs...] [--angle <angle>] [--force]');
    process.exit(1);
  }

  await dbConnect();

  const known = await Concept.find({}, { slug: 1 }).sort({ slug: 1 }).lean<{ slug: string }[]>();
  const knownSlugs = new Set(known.map((k) => k.slug));
  for (const slug of slugs) {
    if (!knownSlugs.has(slug)) {
      console.error(
        `Unknown slug "${slug}". Seeded concepts:\n  ${[...knownSlugs].join(', ')}\n` +
          `(If the list is empty, run: npm run seed)`,
      );
      await dbDisconnect();
      process.exit(1);
    }
  }

  const results: DraftRunResult[] = [];
  for (const slug of slugs) {
    try {
      const r = await generateForConcept(slug, {
        angles: angle ? [angle] : undefined,
        force,
        log: (m) => console.error(`  ${m}`),
      });
      results.push(r);
      const outFile = path.join(process.cwd(), 'data', 'drafts', `${slug}.json`);
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, JSON.stringify(r, null, 2));
      console.error(`  saved ${path.relative(process.cwd(), outFile)}`);
    } catch (e) {
      console.error(`\n[${slug}] FAILED: ${(e as Error).message}`);
      process.exitCode = 1;
    }
  }

  for (const r of results) printResult(r);
  if (results.length > 1) {
    console.log(
      `\n${results.length} drafts: ${results.filter((r) => r.status === 'pass').length} pass, ${results.filter((r) => r.status === 'dead').length} dead`,
    );
  }
  await dbDisconnect();
}

void main();
