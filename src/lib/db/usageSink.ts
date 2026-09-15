import { setUsageSink } from '../anthropic';
import { Usage } from './models';

let installed = false;
let currentSlug: string | null = null;

/** Attribute subsequent API calls to a concept (null to clear). */
export function setUsageConcept(slug: string | null): void {
  currentSlug = slug;
}

/** Standing rule: every API call's token usage is persisted to the usage collection. */
export function installUsageSink(): void {
  if (installed) return;
  installed = true;
  setUsageSink((row) => {
    Usage.create({ ...row, at: new Date(row.at), conceptSlug: currentSlug }).catch((e: unknown) => {
      console.error(`  [usage] failed to persist to Mongo: ${(e as Error).message}`);
    });
  });
}
