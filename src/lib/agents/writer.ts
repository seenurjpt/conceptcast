import { callJson, MODELS } from '../anthropic';
import {
  writerOutputSchema,
  RevisionOutputSchema,
  type Angle,
  type Research,
  type WriterOutput,
  type RevisionOutput,
  type Evaluation,
} from '../schemas';
import type { VoiceContext } from '../voice';
import { buildSystem, researchBlock, type ConceptMeta } from './shared';

/**
 * Which three of the four angles to write for a concept (spec §5.4 table).
 * `mechanism` always; the second follows the track; the third is `debug-story`
 * for difficulty-1 concepts (where a narrated bug lands best), else the
 * remaining one of misconception/tradeoff. Rotating angles by track is the
 * first defence against homogenisation (spec §14.2).
 */
export function pickAngles(concept: Pick<ConceptMeta, 'track' | 'difficulty'>): Angle[] {
  const second: Angle =
    concept.track === 'codegen-quality' || concept.track === 'risk' || concept.track === 'team-practice'
      ? 'misconception'
      : 'tradeoff';
  const other: Angle = second === 'misconception' ? 'tradeoff' : 'misconception';
  const third: Angle = concept.difficulty === 1 ? 'debug-story' : other;
  return ['mechanism', second, third];
}

export interface WriterInput {
  concept: ConceptMeta;
  research: Research;
  voice: VoiceContext;
  angles: Angle[];
}

/** Writer — Sonnet 5 + voice profile (spec §5.4). */
export async function runWriter(input: WriterInput): Promise<WriterOutput> {
  return callJson({
    stage: 'writer',
    model: MODELS.heavy,
    system: buildSystem(['writer'], input.voice),
    maxTokens: 8_000,
    messages: [
      {
        role: 'user',
        content:
          `# Concept\n\ntitle: ${input.concept.title}\ntrack: ${input.concept.track}\n` +
          `difficulty: ${input.concept.difficulty}\n\n` +
          `# Angles to write (exactly these, one variant each)\n\n${input.angles.map((a) => `- ${a}`).join('\n')}\n\n` +
          researchBlock(input.research),
      },
    ],
    schema: writerOutputSchema(input.angles),
  });
}

export interface ReviserInput {
  research: Research;
  voice: VoiceContext;
  failing: { angle: Angle; body: string };
  critique: Evaluation & { revisionNotes: string };
  constraintViolations: string[];
}

/** The one allowed revision pass (spec §5.5). */
export async function runReviser(input: ReviserInput): Promise<RevisionOutput> {
  return callJson({
    stage: 'reviser',
    model: MODELS.heavy,
    system: buildSystem(['reviser'], input.voice),
    maxTokens: 4_000,
    messages: [
      {
        role: 'user',
        content:
          `${researchBlock(input.research)}\n\n` +
          `# Failing draft (angle: ${input.failing.angle}, ${input.failing.body.length} chars)\n\n${input.failing.body}\n\n` +
          `# Critic evaluation\n\n\`\`\`json\n${JSON.stringify(input.critique, null, 2)}\n\`\`\`\n\n` +
          (input.constraintViolations.length
            ? `# Machine constraint violations\n\n${input.constraintViolations.map((x) => `- ${x}`).join('\n')}`
            : ''),
      },
    ],
    schema: RevisionOutputSchema,
  });
}
