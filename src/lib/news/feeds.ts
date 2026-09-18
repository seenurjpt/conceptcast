/**
 * Feed intake for the AI-driven-development beat. Pulls items (title, link,
 * summary, date) from RSS and Atom without a parser dependency, then keeps
 * only the ones that are about building software with AI.
 *
 * Override the list with NEWS_FEEDS=url1,url2 in .env.local.
 */

export interface FeedItem {
  title: string;
  link: string;
  summary: string;
  publishedAt: Date | null;
  feed: string;
}

export const DEFAULT_NEWS_FEEDS = [
  'https://hnrss.org/newest?q=%22Claude+Code%22+OR+Cursor+OR+Copilot+OR+Codex+OR+%22coding+agent%22&points=30',
  'https://hnrss.org/frontpage',
  'https://simonwillison.net/atom/everything/',
  'https://github.blog/feed/',
  'https://changelog.com/feed',
  'https://stackoverflow.blog/feed/',
  'https://newsletter.pragmaticengineer.com/feed',
];

export function newsFeedUrls(): string[] {
  const env = process.env.NEWS_FEEDS;
  if (!env) return DEFAULT_NEWS_FEEDS;
  return env
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The beat filter. Deliberately about *using* AI to build software: tools,
 * agents, workflows, reviews, costs, incidents. Model releases only pass when
 * the headline ties them to coding.
 */
export const BEAT_RE = new RegExp(
  [
    'claude code',
    'cursor',
    'copilot',
    'codex',
    'windsurf',
    'aider',
    'devin',
    'jules',
    'cline',
    'coding agent',
    'code agent',
    'agentic (coding|engineering|development)',
    'ai[- ]assisted',
    'ai[- ](coding|code|pair|programming|developer|dev|engineering|ide|generated)',
    'vibe[- ]cod',
    'code gen(eration)?',
    'codegen',
    'generated code',
    'llm[- ]written',
    'mcp\\b',
    'model context protocol',
    'agents?\\.md',
    'claude\\.md',
    'swe-bench',
    'prompt injection',
    'ai (pull request|pr\\b|code review)',
    'code review.{0,20}\\b(ai|llm|agent)',
    '(llm|ai|agent)s?.{0,30}\\b(refactor|codebase|pull request|test suite|ci\\b|repo)',
    '(gpt|gemini|claude|llama|deepseek|qwen).{0,30}\\b(code|coding|developer)',
  ].join('|'),
  'i',
);

export function isOnBeat(item: Pick<FeedItem, 'title' | 'summary'>): boolean {
  return BEAT_RE.test(item.title) || BEAT_RE.test(item.summary.slice(0, 600));
}

const STRIP_TAGS = /<[^>]+>/g;

/** CDATA off, tags off, entities decoded, then tags off again: Atom `content type="html"` arrives entity-escaped. */
function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(STRIP_TAGS, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(STRIP_TAGS, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block: string, name: string): string | null {
  const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i').exec(block);
  return m ? m[1] : null;
}

function atomLink(block: string): string | null {
  // Prefer rel="alternate"; fall back to the first <link href>.
  const links = [...block.matchAll(/<link\b([^>]*?)\/?>/gi)].map((m) => m[1]);
  const pick = links.find((a) => /rel=["']alternate["']/i.test(a)) ?? links.find((a) => !/rel=/i.test(a)) ?? links[0];
  if (!pick) return null;
  const href = /href=["']([^"']+)["']/i.exec(pick);
  return href ? href[1] : null;
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(decode(s));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** RSS `<item>` and Atom `<entry>` → FeedItem. Items without a link are dropped. */
export function extractItems(xml: string, feed = ''): FeedItem[] {
  const out: FeedItem[] = [];
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) ?? [];
  for (const block of blocks) {
    const title = decode(tag(block, 'title') ?? '');
    if (!title) continue;
    const isAtom = /^<entry/i.test(block);
    const rawLink = isAtom ? atomLink(block) : (tag(block, 'link') ?? atomLink(block));
    const link = rawLink ? decode(rawLink) : '';
    if (!/^https?:\/\//i.test(link)) continue;
    const summary = decode(tag(block, 'description') ?? tag(block, 'summary') ?? tag(block, 'content') ?? '').slice(0, 1200);
    const publishedAt = parseDate(tag(block, 'pubDate') ?? tag(block, 'published') ?? tag(block, 'updated') ?? tag(block, 'dc:date'));
    out.push({ title, link, summary, publishedAt, feed });
  }
  return out;
}

export async function fetchFeed(url: string): Promise<FeedItem[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'conceptcast/0.1 (news scanner)' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return [];
    return extractItems(await res.text(), url);
  } catch {
    return [];
  }
}

/** Every on-beat item from every feed, newest first, de-duplicated by link. */
export async function fetchBeatItems(maxAgeDays = 4): Promise<{ scanned: number; items: FeedItem[] }> {
  const all = (await Promise.all(newsFeedUrls().map(fetchFeed))).flat();
  const cutoff = Date.now() - maxAgeDays * 86_400_000;
  const seen = new Set<string>();
  const items = all
    .filter((i) => i.publishedAt === null || i.publishedAt.getTime() >= cutoff)
    .filter((i) => isOnBeat(i))
    .filter((i) => {
      const key = i.link.replace(/[?#].*$/, '').replace(/\/$/, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
  return { scanned: all.length, items };
}
