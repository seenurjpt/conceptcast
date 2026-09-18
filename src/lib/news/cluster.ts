/**
 * Groups feed items into stories. Deterministic: token-Jaccard on titles,
 * greedy merge, so the same items always produce the same clusters. A story
 * covered by several feeds outranks a single post.
 */
import type { FeedItem } from './feeds';

export interface StoryCluster {
  /** The newest item's title, used as the headline. */
  headline: string;
  items: FeedItem[];
  newestAt: Date | null;
  score: number;
}

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'it', 'for', 'on', 'that', 'this', 'with', 'as', 'your', 'you',
  'how', 'why', 'what', 'new', 'now', 'vs', 'from', 'by', 'at', 'are', 'be', 'i', 'my', 'we', 'our', 'ai', 'show', 'hn',
  'ask', 'launch', 'introducing', 'using', 'use',
]);

export function titleTokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9.+\s-]/g, ' ')
      .split(/\s+/)
      .map((t) => t.replace(/^[.-]+|[.-]+$/g, ''))
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );
}

export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  // Overlap coefficient rather than Jaccard: a short HN title that is a
  // subset of a long blog title is the same story.
  return inter / Math.min(ta.size, tb.size);
}

export const CLUSTER_THRESHOLD = 0.5;

export function clusterItems(items: FeedItem[], threshold = CLUSTER_THRESHOLD, now = Date.now()): StoryCluster[] {
  const clusters: FeedItem[][] = [];
  for (const item of items) {
    const home = clusters.find((c) => c.some((o) => titleSimilarity(o.title, item.title) >= threshold));
    if (home) home.push(item);
    else clusters.push([item]);
  }
  return clusters
    .map((c) => {
      const newestAt = c.reduce<Date | null>((acc, i) => (i.publishedAt && (!acc || i.publishedAt > acc) ? i.publishedAt : acc), null);
      const headline = (c.find((i) => i.publishedAt && i.publishedAt.getTime() === newestAt?.getTime()) ?? c[0]).title;
      return { headline, items: c, newestAt, score: scoreCluster(c, newestAt, now) };
    })
    .sort((a, b) => b.score - a.score || a.headline.localeCompare(b.headline));
}

/** Coverage counts most; recency breaks ties; undated items get no recency credit. */
export function scoreCluster(items: FeedItem[], newestAt: Date | null, now = Date.now()): number {
  const feeds = new Set(items.map((i) => i.feed)).size;
  let score = items.length + feeds * 2;
  if (newestAt) {
    const hours = (now - newestAt.getTime()) / 3_600_000;
    if (hours <= 24) score += 3;
    else if (hours <= 72) score += 1;
  }
  return score;
}
