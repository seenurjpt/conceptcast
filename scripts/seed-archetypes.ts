/**
 * Seeds the six post archetypes (idempotent upsert by slug) and ensures the
 * post-generation indexes exist.
 *
 *   npm run seed:archetypes
 */
import { loadEnvLocal } from '../src/lib/loadEnv';
import type { ArchetypeSeed } from '../src/lib/schemas/post';

export const ARCHETYPES: ArchetypeSeed[] = [
  {
    slug: 'concept-unpack',
    name: 'Concept unpack',
    description:
      'Take one mechanism the audience uses daily without understanding and explain the part that actually matters. No war story needed; the insight is the evidence.',
    structure: [
      { slot: 'hook', guidance: 'Name the thing everyone uses and the one fact about it they have wrong or never checked.', maxChars: 140 },
      { slot: 'rehook', guidance: 'One sentence that says why the misunderstanding costs something concrete.', maxChars: 200 },
      { slot: 'context', guidance: 'Where this shows up in a real system. Two or three sentences, first person.', minChars: 150, maxChars: 400 },
      { slot: 'body', guidance: 'The mechanism, in the order it executes. Concrete before abstract. A short → list is fine.', minChars: 600, maxChars: 1100 },
      { slot: 'takeaway', guidance: 'The one thing to do differently tomorrow because of this.', minChars: 80, maxChars: 250 },
      { slot: 'cta', guidance: 'A real question about how the reader handles the same mechanism.', maxChars: 160 },
    ],
    hookPatterns: [
      'X does not do what you think it does.',
      'The part of X nobody reads is the part that decides Y.',
      'You have used X a hundred times. Here is what it is actually doing.',
    ],
    suitableFor: ['fundamentals', 'internals', 'tokenization', 'attention', 'embeddings', 'caching'],
    requiresFirsthandEvidence: false,
  },
  {
    slug: 'myth-vs-reality',
    name: 'Myth vs reality',
    description: 'A widely repeated belief, the moment it broke for you, and what is actually true. Needs a first-hand failure.',
    structure: [
      { slot: 'hook', guidance: 'State the myth as the crowd states it, then one word or clause that flips it.', maxChars: 140 },
      { slot: 'rehook', guidance: 'Who believes the myth and why it is reasonable to believe it.', maxChars: 220 },
      { slot: 'context', guidance: 'The system where you believed it too, and what you were trying to do.', minChars: 150, maxChars: 400 },
      { slot: 'body', guidance: 'The moment it broke. What you saw, what you measured (only verified anchors), what was actually going on.', minChars: 600, maxChars: 1100 },
      { slot: 'takeaway', guidance: 'The corrected rule, stated so it can be argued with.', minChars: 80, maxChars: 250 },
      { slot: 'cta', guidance: 'Ask where the myth still holds, or for the counter-example you have not seen.', maxChars: 160 },
    ],
    hookPatterns: ['Everyone says X. X is wrong, and here is the log line that proves it.', 'I believed X for two years. One incident fixed that.'],
    suitableFor: ['misconceptions', 'performance', 'retrieval', 'evaluation', 'prompting'],
    requiresFirsthandEvidence: true,
  },
  {
    slug: 'build-log',
    name: 'Build log',
    description: 'What you built this week, the one decision that mattered, and what you would do differently. Needs you to have built it.',
    structure: [
      { slot: 'hook', guidance: 'The thing you shipped plus the single surprising fact from building it.', maxChars: 140 },
      { slot: 'rehook', guidance: 'Why you built it, in one sentence, with the constraint that shaped it.', maxChars: 200 },
      { slot: 'context', guidance: 'Stack, scale, and the goal. Named tools are good here.', minChars: 120, maxChars: 350 },
      { slot: 'body', guidance: 'The decision that mattered, the alternatives you rejected, what happened. Step order, → list allowed.', minChars: 600, maxChars: 1100 },
      { slot: 'takeaway', guidance: 'What you would do differently, or the rule you extracted.', minChars: 80, maxChars: 250 },
      { slot: 'cta', guidance: 'Ask how others solved the same decision.', maxChars: 160 },
    ],
    hookPatterns: ['Shipped X. The hard part was not the part I expected.', 'Built X in N days. One decision saved the whole thing.'],
    suitableFor: ['agents', 'tooling', 'infra', 'rag', 'fine-tuning', 'orchestration'],
    requiresFirsthandEvidence: true,
  },
  {
    slug: 'depth-ladder',
    name: 'Depth ladder',
    description: 'The same concept explained at three depths, so the reader can see where their own understanding stops.',
    structure: [
      { slot: 'hook', guidance: 'Promise the ladder: most people stop at rung one.', maxChars: 140 },
      { slot: 'rehook', guidance: 'Why the deeper rungs change a decision the reader makes.', maxChars: 200 },
      { slot: 'context', guidance: 'Where the concept shows up in day-to-day work.', minChars: 120, maxChars: 350 },
      { slot: 'body', guidance: 'Rung 1 (what it is), rung 2 (how it works), rung 3 (why it fails). Use → or • to separate rungs.', minChars: 700, maxChars: 1200 },
      { slot: 'takeaway', guidance: 'Which rung the reader needs for their job, and how to tell.', minChars: 80, maxChars: 250 },
      { slot: 'cta', guidance: 'Ask which rung they are on, or for a rung four.', maxChars: 160 },
    ],
    hookPatterns: ['Three ways to understand X. Most people stop at the first.', 'You know X. Do you know why X fails?'],
    suitableFor: ['fundamentals', 'attention', 'embeddings', 'sampling', 'evaluation'],
    requiresFirsthandEvidence: false,
  },
  {
    slug: 'decision-framework',
    name: 'Decision framework',
    description: 'When to choose A over B, with the one variable that decides it. Needs a decision you actually made.',
    structure: [
      { slot: 'hook', guidance: 'Name the choice and the variable people ignore when making it.', maxChars: 140 },
      { slot: 'rehook', guidance: 'What choosing wrong costs, concretely.', maxChars: 200 },
      { slot: 'context', guidance: 'The decision you faced and what you had to work with.', minChars: 150, maxChars: 400 },
      { slot: 'body', guidance: 'The framework: the deciding variable, the thresholds, the exceptions. → list for the rules.', minChars: 600, maxChars: 1100 },
      { slot: 'takeaway', guidance: 'The framework compressed into one sentence.', minChars: 60, maxChars: 220 },
      { slot: 'cta', guidance: 'Ask what variable others use, or where the framework breaks.', maxChars: 160 },
    ],
    hookPatterns: ['A vs B is the wrong question. The right one is about X.', 'Pick A if X. Pick B if Y. Nothing else matters.'],
    suitableFor: ['architecture', 'vector-databases', 'fine-tuning', 'prompting', 'cost'],
    requiresFirsthandEvidence: true,
  },
  {
    slug: 'post-mortem',
    name: 'Post-mortem',
    description: 'Something broke in production. The timeline, the root cause, and the fix. Needs the incident to be yours.',
    structure: [
      { slot: 'hook', guidance: 'The symptom as you first saw it, in the words of the alert or the user.', maxChars: 140 },
      { slot: 'rehook', guidance: 'Why the obvious cause was not the cause.', maxChars: 200 },
      { slot: 'context', guidance: 'The system, the load, what was normal before it broke.', minChars: 150, maxChars: 400 },
      { slot: 'body', guidance: 'Timeline → root cause → fix. Only verified anchors for any numbers. What you checked first and why it was wrong.', minChars: 600, maxChars: 1100 },
      { slot: 'takeaway', guidance: 'The guard you added, or the assumption you stopped making.', minChars: 80, maxChars: 250 },
      { slot: 'cta', guidance: 'Ask whether others have hit the same failure mode.', maxChars: 160 },
    ],
    hookPatterns: ['The alert said X. The cause was Y, three layers down.', 'We lost N hours to a bug that was one line.'],
    suitableFor: ['incidents', 'reliability', 'latency', 'rate-limits', 'streaming', 'tool-use'],
    requiresFirsthandEvidence: true,
  },
];

async function main(): Promise<void> {
  loadEnvLocal();
  const { archetypes, ensurePostIndexes } = await import('../src/lib/db/collections');
  const { dbDisconnect } = await import('../src/lib/db/connect');
  await ensurePostIndexes();
  for (const a of ARCHETYPES) {
    await archetypes.upsert(a);
    console.log(`upserted archetype ${a.slug}`);
  }
  await dbDisconnect();
}

if (process.argv[1] && /seed-archetypes\.ts$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
