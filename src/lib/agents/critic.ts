import { callJson, MODELS } from '../anthropic';
import { CritiqueSchema, type Angle, type Critique, type Research } from '../schemas';
import type { VoiceContext } from '../voice';
import { buildSystem, researchBlock } from './shared';

export interface VariantForCritique {
  angle: Angle;
  body: string;
  constraintViolations: string[];
}

export interface CriticInput {
  research: Research;
  voice: VoiceContext;
  /** Hooks of the last 10 published posts, for the structural-distinctness check. */
  recentHooks: string[];
  variants: VariantForCritique[];
}

/** Critic — Sonnet 5 + depth rubric v2 (spec §5.5). */
export async function runCritic(input: CriticInput): Promise<Critique> {
  const variantBlocks = input.variants
    .map(
      (v) =>
        `<variant angle="${v.angle}" chars="${v.body.length}">\n${v.body}\n</variant>\n` +
        (v.constraintViolations.length
          ? `Machine constraint check FAILED for this variant:\n${v.constraintViolations.map((x) => `- ${x}`).join('\n')}`
          : 'Machine constraint check passed for this variant.'),
    )
    .join('\n\n');

  const hooks = input.recentHooks.length
    ? input.recentHooks.map((h, i) => `${i + 1}. ${h.replace(/\n/g, ' / ')}`).join('\n')
    : '(nothing published yet)';

  return callJson({
    stage: 'critic',
    model: MODELS.heavy,
    system: buildSystem(['critic', 'rubric.v2'], input.voice),
    maxTokens: 16_000,
    messages: [
      {
        role: 'user',
        content:
          `${researchBlock(input.research)}\n\n` +
          `# Hooks of the last 10 published posts\n\n${hooks}\n\n` +
          `# Drafts\n\n${variantBlocks}\n\n` +
          `Evaluate every variant. A machine constraint failure is a triggered auto-fail condition.`,
      },
    ],
    schema: CritiqueSchema,
  });
}

export const PASS_SCORE = 7;

export function passes(e: { score: number; autoFails: string[] }, violations: string[]): boolean {
  return e.score >= PASS_SCORE && e.autoFails.length === 0 && violations.length === 0;
}
