import { z } from 'zod';

/* ── research ─────────────────────────────────────────────────────────────── */

export const FactSchema = z.object({
  text: z.string(),
  sourceUrl: z.url(),
  type: z.enum(['number', 'behaviour', 'tradeoff', 'gotcha']),
  confidence: z.enum(['high', 'medium']),
});
export type Fact = z.infer<typeof FactSchema>;

export const ResearchSchema = z
  .object({
    mechanism: z.string().min(400),
    facts: z.array(FactSchema).min(5),
    misconceptions: z
      .array(
        z.object({
          belief: z.string(),
          reality: z.string(),
          sourceUrl: z.url(),
        }),
      )
      .min(1),
    codeExample: z
      .object({
        language: z.string(),
        snippet: z.string(),
        explanation: z.string(),
      })
      .nullable(),
    devImplication: z.string(),
    analogyCandidates: z.array(z.string()),
  })
  .refine((r) => r.facts.filter((f) => f.type === 'number').length >= 2, {
    message: "at least two facts must have type 'number'",
  });
export type Research = z.infer<typeof ResearchSchema>;

/* ── angles ───────────────────────────────────────────────────────────────── */

export const ANGLES = ['mechanism', 'misconception', 'tradeoff', 'debug-story'] as const;
export const AngleSchema = z.enum(ANGLES);
export type Angle = z.infer<typeof AngleSchema>;

/* ── writer ───────────────────────────────────────────────────────────────── */

const VariantSchema = z.object({
  angle: AngleSchema,
  body: z.string(),
});

/** The writer is asked for a specific set of angles; the schema enforces exactly those. */
export function writerOutputSchema(angles: readonly Angle[]) {
  return z
    .object({ variants: z.array(VariantSchema).length(angles.length) })
    .refine(
      (o) => {
        const got = new Set(o.variants.map((v) => v.angle));
        return got.size === angles.length && angles.every((a) => got.has(a));
      },
      { message: `variants must cover exactly these angles: ${angles.join(', ')}` },
    );
}
export type WriterOutput = { variants: { angle: Angle; body: string }[] };

export const RevisionOutputSchema = VariantSchema;
export type RevisionOutput = z.infer<typeof RevisionOutputSchema>;

/* ── critic ───────────────────────────────────────────────────────────────── */

export const AUTO_FAIL_CHECKS = [
  'mechanism',
  'grounding',
  'specificity',
  'surprise',
  'news-drift',
  'overclaiming',
  'voice',
  'slop',
  'length',
  'distinctness',
] as const;
export type AutoFailCheck = (typeof AUTO_FAIL_CHECKS)[number];

const EvaluationSchema = z.object({
  angle: AngleSchema,
  score: z.number().int().min(1).max(10),
  autoFails: z.array(z.enum(AUTO_FAIL_CHECKS)),
  issues: z.array(z.string()),
  strengths: z.array(z.string()),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

export const CritiqueSchema = z.object({
  evaluations: z.array(EvaluationSchema).min(1),
  winner: AngleSchema,
  /** Concrete instructions for the one allowed revision pass. */
  revisionNotes: z.string(),
});
export type Critique = z.infer<typeof CritiqueSchema>;

/* ── selector ─────────────────────────────────────────────────────────────── */

export const SelectorOutputSchema = z.object({
  rankings: z
    .array(
      z.object({
        slug: z.string(),
        teachability: z.number().min(0).max(10),
        surprise: z.number().min(0).max(10),
        applicability: z.number().min(0).max(10),
        reasoning: z.string(),
      }),
    )
    .min(1),
});
export type SelectorOutput = z.infer<typeof SelectorOutputSchema>;

/* ── voice ────────────────────────────────────────────────────────────────── */

export const VoiceExtractSchema = z.object({
  styleGuide: z.string().min(200),
});

/* ── timeliness ───────────────────────────────────────────────────────────── */

export const TimelinessOutputSchema = z.object({
  matches: z.array(
    z.object({
      slug: z.string(),
      headline: z.string(),
    }),
  ),
});

/* ── concept proposals ────────────────────────────────────────────────────── */

export const ProposalOutputSchema = z.object({
  proposals: z
    .array(
      z.object({
        slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
        title: z.string(),
        track: z.string(),
        oneLiner: z.string(),
        focus: z.string(),
        prerequisites: z.array(z.string()),
        difficulty: z.number().int().min(1).max(3),
        devRelevance: z.number().min(0).max(10),
        primarySources: z.array(
          z.object({
            type: z.enum(['paper', 'docs', 'repo', 'blog']),
            url: z.url(),
            title: z.string(),
          }),
        ),
        rationale: z.string(),
      }),
    )
    .min(1),
});
export type ProposalOutput = z.infer<typeof ProposalOutputSchema>;
