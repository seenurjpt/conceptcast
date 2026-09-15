/**
 * Runs the selector (eligibility filter + Haiku ranking) and prints the
 * ranking. Add --generate to also run the pipeline for the winner.
 *
 *   npm run select [-- --generate]
 */
import { loadEnvLocal } from '../src/lib/loadEnv';
import { dbConnect, dbDisconnect } from '../src/lib/db/connect';
import { installUsageSink } from '../src/lib/db/usageSink';
import { selectNextConcept } from '../src/lib/agents/selector';
import { generateForConcept } from '../src/lib/pipeline/generate';

async function main(): Promise<void> {
  loadEnvLocal();
  await dbConnect();
  installUsageSink();

  const r = await selectNextConcept();
  console.log(`${r.eligible} eligible concept(s)`);
  for (const c of r.ranked) {
    console.log(
      `  ${c.total.toFixed(1).padStart(5)}  ${c.slug.padEnd(28)} teach=${c.teachability} surprise=${c.surprise} apply=${c.applicability}` +
        ` rel=${c.devRelevance} boost=${c.timelinessBoost}\n         ${c.reasoning}`,
    );
  }
  console.log(`\nchosen: ${r.chosen?.slug ?? '(nothing)'}`);

  if (process.argv.includes('--generate') && r.chosen) {
    const result = await generateForConcept(r.chosen.slug, { log: (m) => console.error(`  ${m}`) });
    console.log(`\n${result.conceptSlug}: ${result.status} (score ${result.score}) draft ${result.draftId}`);
  }
  await dbDisconnect();
}

void main();
