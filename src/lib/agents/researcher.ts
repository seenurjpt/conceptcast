import { callJson, MODELS } from '../anthropic';
import type { FetchedSource } from '../fetchSource';
import { ResearchSchema, type Research } from '../schemas';
import { buildSystem, type ConceptMeta } from './shared';

/**
 * Researcher: the user's standard-tier model + web search (spec §5.3).
 * When fewer than two primary sources resolved, the researcher gets more
 * search budget and is told to fill the gap itself (spec §5.2 step 3).
 */
export async function runResearcher(
  concept: ConceptMeta,
  sources: FetchedSource[],
  ctx: { audience?: string } = {},
): Promise<Research> {
  const sourceBlocks = sources
    .map(
      (s) =>
        `<source url="${s.url}"${s.truncated ? ' truncated="true"' : ''}>\n${s.text}\n</source>`,
    )
    .join('\n\n');

  const thin = sources.length < 2;
  const gapNote = thin
    ? `\n\nOnly ${sources.length} primary source(s) resolved. Use web_search to find the primary source ` +
      `(paper, official docs, or repo) for this concept before extracting facts.`
    : '';

  return callJson({
    stage: 'researcher',
    model: MODELS.heavy,
    system: buildSystem(['researcher']),
    maxTokens: 16_000,
    webSearch: { maxUses: thin ? 10 : 6 },
    messages: [
      {
        role: 'user',
        content:
          `# Concept\n\ntitle: ${concept.title}\n` +
          (concept.topicTitle
            ? `main topic: ${concept.topicTitle}${concept.topicDescription ? `: ${concept.topicDescription}` : ''}\n`
            : `track: ${concept.track}\n`) +
          `difficulty: ${concept.difficulty}\nfocus: ${concept.focus || concept.title}\n\n` +
          (ctx.audience ? `# Audience\n\n${ctx.audience}\n\n` : '') +
          `# Primary sources\n\n${sourceBlocks || '(none resolved)'}${gapNote}`,
      },
    ],
    schema: ResearchSchema,
  });
}

/** Spec rule: medium-confidence facts never reach the writer. */
export function dropMediumConfidence(research: Research): Research {
  const facts = research.facts.filter((f) => f.confidence === 'high');
  const numbers = facts.filter((f) => f.type === 'number').length;
  if (facts.length < 5 || numbers < 2) {
    console.error(
      `  [warn] after dropping medium-confidence facts: ${facts.length} facts, ${numbers} numbers remain`,
    );
  }
  return { ...research, facts };
}
