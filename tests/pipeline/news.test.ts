import { describe, expect, it } from 'vitest';
import { extractItems, isOnBeat, type FeedItem } from '@/lib/news/feeds';
import { clusterItems, titleSimilarity } from '@/lib/news/cluster';

const RSS = `<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[Claude Code now runs background agents]]></title><link>https://example.com/a</link>
  <description><![CDATA[<p>Anthropic shipped &amp; documented it.</p>]]></description><pubDate>Tue, 15 Sep 2026 10:00:00 GMT</pubDate></item>
<item><title>No link here</title><description>dropped</description></item>
<item><title>Series B for a fintech</title><link>https://example.com/b</link><description>money</description></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
<entry><title>Cursor background agents: what changed</title>
  <link rel="alternate" href="https://example.com/c"/><link rel="self" href="https://example.com/self"/>
  <summary>How the agent behaves.</summary><published>2026-09-16T08:00:00Z</published></entry>
<entry><title>Prompt injection via MCP tool results</title><link href="https://example.com/d"/>
  <content type="html">&lt;p&gt;An agent read a page and obeyed it.&lt;/p&gt;</content><updated>2026-09-14T08:00:00Z</updated></entry>
</feed>`;

describe('feeds', () => {
  it('extracts RSS items with title, link, decoded summary and date; drops items without a link', () => {
    const items = extractItems(RSS, 'rss');
    expect(items.map((i) => i.link)).toEqual(['https://example.com/a', 'https://example.com/b']);
    expect(items[0].title).toBe('Claude Code now runs background agents');
    expect(items[0].summary).toBe('Anthropic shipped & documented it.');
    expect(items[0].publishedAt?.toISOString()).toBe('2026-09-15T10:00:00.000Z');
    expect(items[0].feed).toBe('rss');
  });

  it('extracts Atom entries, preferring the alternate link', () => {
    const items = extractItems(ATOM, 'atom');
    expect(items.map((i) => i.link)).toEqual(['https://example.com/c', 'https://example.com/d']);
    expect(items[1].summary).toBe('An agent read a page and obeyed it.');
    expect(items[1].publishedAt?.toISOString()).toBe('2026-09-14T08:00:00.000Z');
  });

  it('keeps AI-driven-development stories and drops the rest', () => {
    const on = [
      'Claude Code now runs background agents',
      'We let Copilot open pull requests for a month',
      'Prompt injection via MCP tool results',
      'GPT-5.5 is much better at code',
      'Vibe coding a SaaS in a weekend',
    ];
    const off = ['Series B for a fintech', 'New transformer attention variant', 'Rust 2.0 released', 'Gemini adds image generation'];
    for (const t of on) expect(isOnBeat({ title: t, summary: '' }), t).toBe(true);
    for (const t of off) expect(isOnBeat({ title: t, summary: '' }), t).toBe(false);
    expect(isOnBeat({ title: 'Weekly notes', summary: 'Mostly about how Cursor handles a large repo' })).toBe(true);
  });
});

function item(title: string, opts: Partial<FeedItem> = {}): FeedItem {
  return { title, link: opts.link ?? `https://x.y/${title.replace(/\W+/g, '-')}`, summary: '', publishedAt: opts.publishedAt ?? null, feed: opts.feed ?? 'f' };
}

describe('cluster', () => {
  it('measures title similarity as overlap of the shorter title', () => {
    expect(titleSimilarity('Claude Code background agents', 'Claude Code now runs background agents')).toBeGreaterThanOrEqual(0.5);
    expect(titleSimilarity('Cursor pricing changes', 'Prompt injection via MCP')).toBe(0);
  });

  it('merges the same story from several feeds and keeps distinct stories apart', () => {
    const now = Date.parse('2026-09-18T12:00:00Z');
    const clusters = clusterItems(
      [
        item('Claude Code now runs background agents', { feed: 'hn', publishedAt: new Date('2026-09-18T09:00:00Z') }),
        item('Claude Code background agents explained', { feed: 'simon', publishedAt: new Date('2026-09-18T10:00:00Z') }),
        item('Cursor changes its pricing model', { feed: 'hn', publishedAt: new Date('2026-09-12T10:00:00Z') }),
        item('Prompt injection through MCP tool results', { feed: 'simon' }),
      ],
      0.5,
      now,
    );
    expect(clusters).toHaveLength(3);
    expect(clusters[0].items).toHaveLength(2);
    expect(clusters[0].headline).toBe('Claude Code background agents explained');
    // 2 items + 2 feeds*2 + recency 3
    expect(clusters[0].score).toBe(9);
    expect(clusters.map((c) => c.items.length)).toEqual([2, 1, 1]);
  });

  it('is deterministic: same input, same order', () => {
    const items = ['b story', 'a story', 'c thing entirely'].map((t) => item(t));
    const a = clusterItems(items, 0.5, 0).map((c) => c.headline);
    const b = clusterItems([...items], 0.5, 0).map((c) => c.headline);
    expect(a).toEqual(b);
  });
});
