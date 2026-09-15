/** Fetches a primary source, strips HTML to text, caps at ~8k tokens. */

const MAX_TOKENS_PER_SOURCE = 8_000;
// Rough heuristic: ~4 chars per token for English prose/docs.
const MAX_CHARS = MAX_TOKENS_PER_SOURCE * 4;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) conceptcast/0.1 (personal research tool)';

export interface FetchedSource {
  url: string;
  text: string;
  truncated: boolean;
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', hellip: '…', rsquo: '’',
  lsquo: '‘', rdquo: '”', ldquo: '“', times: '×',
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

export function stripHtml(html: string): string {
  let s = html;
  // Prefer the main content region when the page marks one.
  const main = /<main[\s>][\s\S]*?<\/main>/i.exec(s) ?? /<article[\s>][\s\S]*?<\/article>/i.exec(s);
  if (main && main[0].length > 2_000) s = main[0];
  s = s
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|iframe|head|nav|footer|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(pre|code)[\s>]/gi, '\n$&')
    .replace(/<\/(p|div|section|li|tr|h[1-6]|pre|blockquote|table)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  return s
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function looksLikeMarkdown(body: string, contentType: string): boolean {
  if (/text\/(markdown|plain)/i.test(contentType)) return true;
  return !/<html[\s>]/i.test(body.slice(0, 2_000)) && /(^|\n)#{1,3} /.test(body.slice(0, 5_000));
}

async function get(url: string): Promise<{ body: string; contentType: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/markdown, text/html;q=0.9, */*;q=0.5' },
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    return { body: await res.text(), contentType: res.headers.get('content-type') ?? '' };
  } catch {
    return null;
  }
}

/**
 * Fetches one source URL. Docs platforms (Mintlify etc.) often serve clean
 * markdown at `<url>.md` — try that first, fall back to stripped HTML.
 */
export async function fetchSource(url: string): Promise<FetchedSource> {
  let text: string | null = null;

  if (!/\.(md|txt|pdf)$/i.test(url)) {
    const mdUrl = url.replace(/\/$/, '') + '.md';
    const md = await get(mdUrl);
    if (md && looksLikeMarkdown(md.body, md.contentType) && md.body.length > 500) {
      text = md.body.trim();
    }
  }

  if (text === null) {
    const page = await get(url);
    if (!page) throw new Error(`Failed to fetch ${url}`);
    text = looksLikeMarkdown(page.body, page.contentType) ? page.body.trim() : stripHtml(page.body);
  }

  const truncated = text.length > MAX_CHARS;
  if (truncated) text = text.slice(0, MAX_CHARS);
  return { url, text, truncated };
}
