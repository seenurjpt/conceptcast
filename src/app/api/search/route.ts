import { handler, ok } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { Concept, Draft, Topic, type ConceptDoc, type DraftDoc, type TopicDoc } from '@/lib/db/models';
import { exemplars } from '@/lib/db/collections';
import { visibleTo } from '@/lib/topics/service';
import { customTitle } from '@/lib/customPost';

export const dynamic = 'force-dynamic';

export type SearchKind = 'topic' | 'subtopic' | 'draft' | 'published' | 'exemplar';

export type SearchHit = {
  id: string;
  kind: SearchKind;
  title: string;
  /** Where it lives: the topic, the archetype, the author. */
  context: string | null;
  /** A few words around the match when it was found in the body. */
  snippet: string | null;
  status: string | null;
  href: string;
};

const MAX_QUERY = 80;
const MAX_TERMS = 5;
/** Per group, after ranking. */
const SHOW = 5;
/** Rows fetched per group before ranking, so a title match can beat a newer body match. */
const FETCH = 24;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Title hits first (a title that starts with the query highest), then
 * anything else in its original order.
 */
function rank<T>(rows: T[], title: (r: T) => string, q: string): T[] {
  const lq = q.toLowerCase();
  const score = (r: T) => {
    const t = title(r).toLowerCase();
    if (t.startsWith(lq)) return 0;
    if (t.includes(lq)) return 1;
    return 2;
  };
  return rows
    .map((r, i) => ({ r, i, s: score(r) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.r);
}

/** About 130 characters of `text` around the first term's match, cut at word edges. */
function snippetOf(text: string, terms: RegExp[]): string | null {
  for (const t of terms) {
    const m = new RegExp(t.source, 'i').exec(text);
    if (!m) continue;
    let start = Math.max(0, m.index - 40);
    let end = Math.min(text.length, m.index + m[0].length + 90);
    if (start > 0) start = text.indexOf(' ', start) + 1 || start;
    if (end < text.length) end = text.lastIndexOf(' ', end) > m.index ? text.lastIndexOf(' ', end) : end;
    const body = text.slice(start, end).replace(/\s+/g, ' ').trim();
    return `${start > 0 ? '…' : ''}${body}${end < text.length ? '…' : ''}`;
  }
  return null;
}

/** Every term must match one of the fields. */
function allTerms(terms: RegExp[], fields: string[]) {
  return { $and: terms.map((t) => ({ $or: fields.map((f) => ({ [f]: t })) })) };
}

/**
 * GET /api/search?q= : the command palette's results, grouped by kind.
 *
 * Each word of the query must appear (in any order), case-insensitively.
 * The groups are fetched in parallel and capped, and only the fields the
 * palette shows are read, so a search costs a handful of small queries.
 */
export const GET = handler(async (req: Request) => {
  const userId = await requireUserId();
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY);
  const words = q.split(/\s+/).filter(Boolean).slice(0, MAX_TERMS);
  if (q.length < 2 || words.length === 0) return ok({ q, hits: [] as SearchHit[] });
  const terms = words.map((w) => new RegExp(escape(w), 'i'));

  // One parallel round trip. Subtopics are scoped to the visible topics in
  // memory rather than by a second query, and each draft brings its
  // subtopic's title with it through a lookup.
  type DraftRow = Pick<DraftDoc, '_id' | 'hook' | 'body' | 'status' | 'conceptId' | 'topicId' | 'kind'> & {
    concept: Pick<ConceptDoc, 'title' | 'topicId'>[];
  };
  const [topics, conceptRows, drafts, examples] = await Promise.all([
    Topic.find(visibleTo(userId), { title: 1, description: 1 }).lean<Pick<TopicDoc, '_id' | 'title' | 'description'>[]>(),
    Concept.find(allTerms(terms, ['title', 'oneLiner']), { title: 1, oneLiner: 1, topicId: 1, status: 1 })
      .sort({ createdAt: -1 })
      .limit(FETCH * 2)
      .lean<Pick<ConceptDoc, '_id' | 'title' | 'oneLiner' | 'topicId' | 'status'>[]>(),
    Draft.aggregate<DraftRow>([
      { $match: allTerms(terms, ['hook', 'body']) },
      { $sort: { createdAt: -1 } },
      { $limit: FETCH * 2 },
      { $project: { hook: 1, body: 1, status: 1, conceptId: 1, topicId: 1, kind: 1 } },
      {
        $lookup: {
          from: Concept.collection.name,
          localField: 'conceptId',
          foreignField: '_id',
          pipeline: [{ $project: { title: 1, topicId: 1 } }],
          as: 'concept',
        },
      },
    ]),
    exemplars.search(terms[0], FETCH),
  ]);
  const topicTitle = new Map(topics.map((t) => [String(t._id), t.title]));
  const concepts = conceptRows.filter((c) => c.topicId && topicTitle.has(String(c.topicId)));

  const matchesAll = (text: string) => terms.every((t) => t.test(text));

  const topicHits: SearchHit[] = rank(
    topics.filter((t) => matchesAll(`${t.title} ${t.description}`)),
    (t) => t.title,
    q,
  )
    .slice(0, SHOW)
    .map((t) => ({
      id: String(t._id),
      kind: 'topic',
      title: t.title,
      context: null,
      snippet: t.description || null,
      status: null,
      href: `/backlog/${t._id}`,
    }));

  const subtopicHits: SearchHit[] = rank(concepts, (c) => c.title, q)
    .slice(0, SHOW)
    .map((c) => ({
      id: String(c._id),
      kind: 'subtopic',
      title: c.title,
      context: topicTitle.get(String(c.topicId)) ?? null,
      snippet: c.oneLiner || null,
      status: c.status,
      href: `/backlog/${c.topicId}`,
    }));

  const draftRow = (d: (typeof drafts)[number]): SearchHit => {
    const c = d.concept[0];
    const topicId = c?.topicId ?? d.topicId;
    const title =
      d.kind === 'custom'
        ? customTitle(d.hook)
        : d.kind === 'announcement'
        ?`Starting ${topicTitle.get(String(d.topicId)) ?? 'a new topic'}`
        : (c?.title ?? d.hook.split('\n')[0].slice(0, 90));
    return {
      id: String(d._id),
      kind: d.status === 'published' ? 'published' : 'draft',
      title,
      context: topicId ? (topicTitle.get(String(topicId)) ?? null) : null,
      // The hook is the body's first lines, so the body alone covers both.
      snippet: snippetOf(d.body, terms),
      status: d.status,
      href: `/review?draft=${d._id}&status=${d.status}`,
    };
  };
  const draftRows = rank(drafts.map(draftRow), (h) => h.title, q);

  const exemplarHits: SearchHit[] = examples
    .filter((e) => matchesAll(`${e.rawText} ${e.authorHandle}`))
    .slice(0, SHOW)
    .map((e) => ({
      id: String(e._id),
      kind: 'exemplar',
      title: e.rawText.split('\n')[0].slice(0, 90),
      context: `${e.authorHandle} · ${e.archetypeSlug.replace(/[-_]/g, ' ')}`,
      snippet: snippetOf(e.rawText, terms),
      status: null,
      href: '/admin/exemplars',
    }));

  const hits = [
    ...topicHits,
    ...subtopicHits,
    ...draftRows.filter((h) => h.kind === 'draft').slice(0, SHOW),
    ...draftRows.filter((h) => h.kind === 'published').slice(0, SHOW),
    ...exemplarHits,
  ];
  const res = ok({ q, hits });
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
});
