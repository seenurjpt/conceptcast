/**
 * Optional timeliness signal (spec §3): scan a few feeds for AI headlines,
 * ask Haiku which backlog concepts they relate to, boost those concepts.
 * Never a topic source — a headline can only point at a concept that exists.
 */
import { callJson, MODELS } from '../anthropic';
import { loadPrompt } from '../loadPrompt';
import { Concept, type ConceptDoc } from '../db/models';
import { TimelinessOutputSchema } from '../schemas';

export const BOOST_ON_MATCH = 8;
export const DECAY_PER_DAY = 2;

const DEFAULT_FEEDS = [
  'https://hnrss.org/frontpage',
  'https://hnrss.org/newest?q=LLM&points=50',
  'https://simonwillison.net/atom/everything/',
  'https://huggingface.co/blog/feed.xml',
];

const AI_KEYWORDS =
  /\b(llm|gpt|claude|gemini|llama|mistral|openai|anthropic|deepseek|qwen|transformer|embedding|rag|retrieval|vector|token|context window|fine-?tun|lora|quantiz|inference|agent|mcp|prompt|hallucinat|benchmark|eval|model|ai\b)/i;

export function feedUrls(): string[] {
  const env = process.env.TIMELINESS_FEEDS;
  if (!env) return DEFAULT_FEEDS;
  return env
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Pulls `<title>` text from RSS `<item>`s and Atom `<entry>`s without a parser dependency. */
export function extractHeadlines(xml: string): string[] {
  const out: string[] = [];
  const items = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) ?? [];
  for (const item of items) {
    const m = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(item);
    if (!m) continue;
    const title = m[1]
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    if (title) out.push(title);
  }
  return out;
}

async function fetchHeadlines(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'conceptcast/0.1 (timeliness scanner)' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return [];
    return extractHeadlines(await res.text());
  } catch {
    return [];
  }
}

export interface TimelinessScan {
  headlines: number;
  aiHeadlines: number;
  matches: { slug: string; headline: string }[];
}

export async function scanTimeliness(log: (m: string) => void = () => {}): Promise<TimelinessScan> {
  const all = (await Promise.all(feedUrls().map(fetchHeadlines))).flat();
  const unique = [...new Set(all)];
  const ai = unique.filter((h) => AI_KEYWORDS.test(h)).slice(0, 80);
  log(`${unique.length} headlines, ${ai.length} AI-related`);
  if (ai.length === 0) return { headlines: unique.length, aiHeadlines: 0, matches: [] };

  const concepts = await Concept.find({ status: 'backlog' }).lean<Pick<ConceptDoc, 'slug' | 'title' | 'oneLiner'>[]>();
  if (concepts.length === 0) return { headlines: unique.length, aiHeadlines: ai.length, matches: [] };

  const out = await callJson({
    stage: 'timeliness',
    model: MODELS.light,
    system: [{ type: 'text', text: loadPrompt('timeliness'), cache_control: { type: 'ephemeral' } }],
    maxTokens: 1_000,
    messages: [
      {
        role: 'user',
        content:
          `# Concepts (slug — title — one-liner)\n\n` +
          concepts.map((c) => `${c.slug} — ${c.title} — ${c.oneLiner}`).join('\n') +
          `\n\n# Headlines\n\n${ai.map((h) => `- ${h}`).join('\n')}`,
      },
    ],
    schema: TimelinessOutputSchema,
  });

  const known = new Set(concepts.map((c) => c.slug));
  const matches = out.matches.filter((m) => known.has(m.slug)).slice(0, 5);
  if (matches.length) {
    await Concept.updateMany(
      { slug: { $in: matches.map((m) => m.slug) } },
      { $set: { timelinessBoost: BOOST_ON_MATCH } },
    );
  }
  for (const m of matches) log(`boost ${m.slug} <- "${m.headline}"`);
  return { headlines: unique.length, aiHeadlines: ai.length, matches };
}

/** Daily decay: boost drops by 2/day and never goes below 0. */
export async function decayTimelinessBoosts(): Promise<number> {
  const r1 = await Concept.updateMany(
    { timelinessBoost: { $gt: DECAY_PER_DAY } },
    { $inc: { timelinessBoost: -DECAY_PER_DAY } },
  );
  const r2 = await Concept.updateMany(
    { timelinessBoost: { $gt: 0, $lte: DECAY_PER_DAY } },
    { $set: { timelinessBoost: 0 } },
  );
  return r1.modifiedCount + r2.modifiedCount;
}
