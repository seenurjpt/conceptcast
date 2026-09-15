/**
 * Dev-only: verifies every primary source URL in the seed data actually
 * resolves and yields usable text. Prints a short content preview so titles
 * can be eyeballed against the claimed source.
 *
 *   npx tsx scripts/verify-sources.ts [--only <slug>]
 */
import { SEED_CONCEPTS } from '../src/lib/concepts/seed';
import { fetchSource } from '../src/lib/fetchSource';

async function main(): Promise<void> {
  const onlyIdx = process.argv.indexOf('--only');
  const only = onlyIdx !== -1 ? process.argv[onlyIdx + 1] : null;

  const seen = new Set<string>();
  const failures: string[] = [];

  for (const c of SEED_CONCEPTS) {
    if (only && c.slug !== only) continue;
    for (const s of c.primarySources) {
      if (seen.has(s.url)) continue;
      seen.add(s.url);
      try {
        const fetched = await fetchSource(s.url);
        const preview = fetched.text.slice(0, 120).replace(/\s+/g, ' ');
        console.log(`OK   ${c.slug.padEnd(26)} ${s.url}\n     ${fetched.text.length} chars | ${preview}`);
      } catch (e) {
        failures.push(`${c.slug}: ${s.url}`);
        console.log(`FAIL ${c.slug.padEnd(26)} ${s.url}  (${(e as Error).message})`);
      }
    }
  }

  console.log(`\n${seen.size} unique URLs checked, ${failures.length} failed.`);
  if (failures.length > 0) {
    console.log(failures.map((f) => `  - ${f}`).join('\n'));
    process.exitCode = 1;
  }
}
void main();
