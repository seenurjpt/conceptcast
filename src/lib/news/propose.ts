/**
 * Daily news → topic proposals. Fetch the beat feeds, cluster by story, ask a
 * cheap model which clusters deserve a post, and write the keepers into
 * `conceptProposals` with source 'news' for the human to accept or reject.
 *
 * Nothing here generates a post. Accepting a proposal creates a backlog topic
 * whose primary sources are the story links; the existing research stage
 * reads those, and the critic's link ban keeps them out of the post body.
 */
import { callJson, MODELS } from '../anthropic';
import { loadPrompt } from '../loadPrompt';
import { Concept, ConceptProposal, type ConceptDoc, type ConceptProposalDoc, type NewsStory } from '../db/models';
import { NewsProposeOutputSchema } from '../schemas';
import { TRACKS, type Track } from '../concepts/seed';
import { fetchBeatItems, type FeedItem } from './feeds';
import { clusterItems, type StoryCluster } from './cluster';

/** Proposals below this score are dropped before they reach the queue. */
export const NEWS_MIN_SCORE = Number(process.env.NEWS_MIN_SCORE ?? 5);
/** Unaccepted news proposals expire after this many days; news is perishable. */
export const NEWS_PROPOSAL_TTL_DAYS = Number(process.env.NEWS_PROPOSAL_TTL_DAYS ?? 4);
/** How many story clusters the model sees per scan. */
export const NEWS_MAX_CLUSTERS = 12;

export interface NewsScan {
  scanned: number;
  onBeat: number;
  clusters: number;
  proposed: { slug: string; score: number; headline: string }[];
  dropped: { headline: string; reason: string }[];
}

export function expiryDate(from = new Date(), days = NEWS_PROPOSAL_TTL_DAYS): Date {
  return new Date(from.getTime() + days * 86_400_000);
}

/** Pending news proposals past their expiry become 'expired' (never deleted: they explain the history). */
export async function expireNewsProposals(now = new Date()): Promise<number> {
  const r = await ConceptProposal.updateMany(
    { source: 'news', status: 'pending', expiresAt: { $ne: null, $lte: now } },
    { $set: { status: 'expired' } },
  );
  return r.modifiedCount;
}

function storyOf(c: StoryCluster): NewsStory {
  return {
    headline: c.headline,
    links: c.items.slice(0, 6).map((i: FeedItem) => ({ url: i.link, title: i.title, feed: i.feed, publishedAt: i.publishedAt })),
    newestAt: c.newestAt,
    clusterSize: c.items.length,
    score: c.score,
  };
}

export async function proposeFromNews(log: (m: string) => void = () => {}): Promise<NewsScan> {
  const { scanned, items } = await fetchBeatItems();
  log(`${scanned} feed items, ${items.length} on the beat`);
  const empty: NewsScan = { scanned, onBeat: items.length, clusters: 0, proposed: [], dropped: [] };
  if (items.length === 0) return empty;

  // Links already proposed in the last two weeks (any status) are not proposed again.
  const since = new Date(Date.now() - 14 * 86_400_000);
  const recent = await ConceptProposal.find({ source: 'news', createdAt: { $gte: since } }, { 'story.links.url': 1, slug: 1 }).lean<
    Pick<ConceptProposalDoc, 'slug' | 'story'>[]
  >();
  const seenUrls = new Set(recent.flatMap((p) => p.story?.links.map((l) => l.url) ?? []));

  const clusters = clusterItems(items)
    .filter((c) => !c.items.every((i) => seenUrls.has(i.link)))
    .slice(0, NEWS_MAX_CLUSTERS);
  log(`${clusters.length} new story clusters`);
  if (clusters.length === 0) return { ...empty, clusters: 0 };

  const existing = await Concept.find({}, { slug: 1, title: 1, track: 1 }).lean<Pick<ConceptDoc, 'slug' | 'title' | 'track'>[]>();
  const pending = await ConceptProposal.find({ status: 'pending' }, { slug: 1 }).lean<Pick<ConceptProposalDoc, 'slug'>[]>();
  const taken = new Set([...existing.map((c) => c.slug), ...pending.map((p) => p.slug)]);

  const out = await callJson({
    stage: 'news-propose',
    model: MODELS.light,
    system: [{ type: 'text', text: loadPrompt('news-propose'), cache_control: { type: 'ephemeral' } }],
    maxTokens: 6_000,
    messages: [
      {
        role: 'user',
        content:
          `# Tracks\n\n${TRACKS.join(', ')}\n\n` +
          `# Existing backlog (slug — title [track])\n\n` +
          (existing.map((c) => `${c.slug} — ${c.title} [${c.track}]`).join('\n') || '(empty)') +
          `\n\n# Story clusters\n\n` +
          clusters
            .map(
              (c, i) =>
                `## Cluster ${i}\n` +
                c.items
                  .slice(0, 5)
                  .map((it) => `- ${it.title}\n  ${it.link}\n  ${it.summary.slice(0, 300)}`)
                  .join('\n'),
            )
            .join('\n\n'),
      },
    ],
    schema: NewsProposeOutputSchema,
  });

  const scan: NewsScan = { ...empty, clusters: clusters.length };
  const docs: Partial<ConceptProposalDoc>[] = [];
  for (const t of out.topics) {
    const cluster = clusters[t.clusterIndex];
    if (!cluster) continue;
    const headline = cluster.headline;
    if (!t.keep) {
      scan.dropped.push({ headline, reason: t.rationale || 'not kept' });
      continue;
    }
    if (t.score < NEWS_MIN_SCORE) {
      scan.dropped.push({ headline, reason: `score ${t.score} < ${NEWS_MIN_SCORE}` });
      continue;
    }
    if (!(TRACKS as readonly string[]).includes(t.track)) {
      scan.dropped.push({ headline, reason: `unknown track ${t.track}` });
      continue;
    }
    if (taken.has(t.slug)) {
      scan.dropped.push({ headline, reason: `slug ${t.slug} already exists` });
      continue;
    }
    taken.add(t.slug);
    docs.push({
      slug: t.slug,
      title: t.title,
      track: t.track as Track,
      oneLiner: t.oneLiner,
      focus: t.focus,
      prerequisites: [],
      difficulty: t.difficulty as 1 | 2 | 3,
      devRelevance: t.devRelevance,
      primarySources: cluster.items.slice(0, 4).map((i) => ({ type: 'blog' as const, url: i.link, title: i.title.slice(0, 200) })),
      rationale: t.rationale,
      status: 'pending',
      source: 'news',
      story: storyOf(cluster),
      expiresAt: expiryDate(),
    });
    scan.proposed.push({ slug: t.slug, score: t.score, headline });
  }
  if (docs.length) await ConceptProposal.insertMany(docs);
  for (const p of scan.proposed) log(`proposed ${p.slug} (${p.score}) <- "${p.headline}"`);
  return scan;
}
