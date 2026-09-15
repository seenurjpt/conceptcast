import { fetchSource, type FetchedSource } from '../fetchSource';

export interface ResolvedSources {
  sources: FetchedSource[];
  failed: { url: string; error: string }[];
  /** Fewer than two resolved — the researcher must search to fill the gap (spec §5.2). */
  thin: boolean;
}

/**
 * Source resolver (spec §5.2): fetch every hand-seeded primary source, strip
 * to text, cap at ~8k tokens each. Never throws on a single bad URL.
 */
export async function resolveSources(
  primarySources: { url: string }[],
  log: (msg: string) => void = () => {},
): Promise<ResolvedSources> {
  const urls = [...new Set(primarySources.map((s) => s.url))];
  const settled = await Promise.allSettled(urls.map((u) => fetchSource(u)));
  const sources: FetchedSource[] = [];
  const failed: { url: string; error: string }[] = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      log(`ok ${urls[i]} (${r.value.text.length} chars${r.value.truncated ? ', truncated' : ''})`);
      sources.push(r.value);
    } else {
      const error = r.reason instanceof Error ? r.reason.message : String(r.reason);
      log(`FAILED ${urls[i]}: ${error}`);
      failed.push({ url: urls[i], error });
    }
  });
  return { sources, failed, thin: sources.length < 2 };
}
