/**
 * The beat: AI-driven development. How people build software with AI, not
 * how the models work. The evergreen list below is deliberately small; the
 * daily news scan (src/lib/news) is the main topic source, and these exist so
 * a quiet news day still has something worth writing.
 *
 * The previous model-internals seed (63 concepts) is in git history; run
 * `npm run migrate:news-beat` to retire those rows and seed these.
 */

export const TRACKS = [
  /** Claude Code, Codex, Cursor agents, Copilot agent: how they work and behave. */
  'coding-agents',
  /** Spec-first, plan-then-execute, prompting patterns that hold up. */
  'workflow',
  /** Reviewing, testing and trusting generated code. */
  'codegen-quality',
  /** MCP servers, IDE integrations, benchmarks, the tool ecosystem. */
  'tooling',
  /** What changes for a team: norms, onboarding, ownership. */
  'team-practice',
  /** Tokens, time, throughput: what it actually costs and saves. */
  'economics',
  /** Security of generated code, prompt injection, supply chain. */
  'risk',
] as const;
export type Track = (typeof TRACKS)[number];

export type SourceType = 'paper' | 'docs' | 'repo' | 'blog';

export interface PrimarySource {
  type: SourceType;
  url: string;
  title: string;
}

export interface SeedConcept {
  slug: string;
  title: string;
  track: Track;
  /** The angle that makes this concept worth a post. */
  oneLiner: string;
  prerequisites: string[];
  /** 1 = any dev, 3 = needs to have run agents in anger. */
  difficulty: 1 | 2 | 3;
  /** 0-10, seeded by hand, tuned by engagement later. */
  devRelevance: number;
  /** One-line steer for the researcher. */
  focus: string;
  /** Verify with `npm run verify-sources` after editing. */
  primarySources: PrimarySource[];
}

const anthropicAgents: PrimarySource = {
  type: 'blog',
  url: 'https://www.anthropic.com/engineering/building-effective-agents',
  title: 'Anthropic: Building effective agents',
};
const claudeCodeBestPractices: PrimarySource = {
  type: 'blog',
  url: 'https://www.anthropic.com/engineering/claude-code-best-practices',
  title: 'Anthropic: Claude Code best practices',
};
const fowlerGenAi: PrimarySource = {
  type: 'blog',
  url: 'https://martinfowler.com/articles/exploring-gen-ai.html',
  title: 'Martin Fowler: Exploring generative AI',
};
const willisonCode: PrimarySource = {
  type: 'blog',
  url: 'https://simonwillison.net/2025/Mar/11/using-llms-for-code/',
  title: "Simon Willison: Here's how I use LLMs to help me write code",
};
const sweBenchPaper: PrimarySource = {
  type: 'paper',
  url: 'https://arxiv.org/abs/2310.06770',
  title: 'SWE-bench: Can language models resolve real-world GitHub issues?',
};
const insecureCodePaper: PrimarySource = {
  type: 'paper',
  url: 'https://arxiv.org/abs/2211.03622',
  title: 'Do users write more insecure code with AI assistants?',
};
const dora: PrimarySource = { type: 'blog', url: 'https://dora.dev/', title: 'DORA research' };

export const SEED_CONCEPTS: SeedConcept[] = [
  // ── coding-agents ─────────────────────────────────────────────────────────
  {
    slug: 'agent-loop-anatomy',
    title: 'Agent loop anatomy',
    track: 'coding-agents',
    oneLiner: 'Every coding agent is the same five-step loop; the differences are in what it verifies',
    prerequisites: [],
    difficulty: 1,
    devRelevance: 9,
    focus:
      'What one turn of a coding agent actually does: read context, plan, call a tool, observe, decide whether to stop. Where verification happens and where it does not.',
    primarySources: [
      anthropicAgents,
      { type: 'paper', url: 'https://arxiv.org/abs/2210.03629', title: 'ReAct: Synergizing reasoning and acting in language models' },
    ],
  },
  {
    slug: 'context-files',
    title: 'Context files',
    track: 'coding-agents',
    oneLiner: 'CLAUDE.md and AGENTS.md are the highest-leverage file in your repo and most teams leave them empty',
    prerequisites: ['agent-loop-anatomy'],
    difficulty: 1,
    devRelevance: 9,
    focus:
      'How instruction files are loaded, what belongs in them (commands, conventions, gotchas) versus what does not, and how they degrade when they grow.',
    primarySources: [
      { type: 'docs', url: 'https://agents.md/', title: 'AGENTS.md: a simple, open format for guiding coding agents' },
      claudeCodeBestPractices,
    ],
  },

  // ── workflow ──────────────────────────────────────────────────────────────
  {
    slug: 'spec-first-prompting',
    title: 'Spec-first prompting',
    track: 'workflow',
    oneLiner: 'The prompt that works is a spec you would have had to write anyway',
    prerequisites: [],
    difficulty: 1,
    devRelevance: 8,
    focus:
      'Why a written spec (inputs, outputs, constraints, examples) beats a conversational prompt for non-trivial changes, and what a good one contains.',
    primarySources: [fowlerGenAi, willisonCode],
  },
  {
    slug: 'plan-then-execute',
    title: 'Plan, then execute',
    track: 'workflow',
    oneLiner: 'Asking the agent to plan first is not slower; it is where most of the bad code gets caught',
    prerequisites: ['agent-loop-anatomy'],
    difficulty: 2,
    devRelevance: 8,
    focus:
      'Plan mode and explicit decomposition: what the agent does differently, when it helps, and the failure mode of plans that are never re-read.',
    primarySources: [claudeCodeBestPractices, anthropicAgents],
  },

  // ── codegen-quality ───────────────────────────────────────────────────────
  {
    slug: 'reviewing-generated-code',
    title: 'Reviewing generated code',
    track: 'codegen-quality',
    oneLiner: 'Review is the new bottleneck, and reading generated code like human code is why',
    prerequisites: [],
    difficulty: 1,
    devRelevance: 9,
    focus:
      'What is different about reviewing code nobody wrote: plausible-looking wrong code, over-confident tests, and what to check first.',
    primarySources: [fowlerGenAi, insecureCodePaper],
  },
  {
    slug: 'tests-as-guardrails',
    title: 'Tests as the agent’s compass',
    track: 'codegen-quality',
    oneLiner: 'An agent with a failing test to satisfy behaves completely differently from one without',
    prerequisites: ['agent-loop-anatomy'],
    difficulty: 2,
    devRelevance: 8,
    focus:
      'Test-first prompting: give the agent a red test, let it iterate. What SWE-bench style harnesses reveal about agents that can and cannot run tests.',
    primarySources: [sweBenchPaper, { type: 'docs', url: 'https://aider.chat/docs/', title: 'Aider documentation' }],
  },

  // ── tooling ───────────────────────────────────────────────────────────────
  {
    slug: 'mcp-in-practice',
    title: 'MCP servers for your stack',
    track: 'tooling',
    oneLiner: 'The Model Context Protocol is a USB port for agents, and most teams plug in far too much',
    prerequisites: [],
    difficulty: 2,
    devRelevance: 8,
    focus:
      'What an MCP server exposes (tools, resources, prompts), how tool descriptions eat context, and picking the three servers that matter.',
    primarySources: [
      { type: 'docs', url: 'https://modelcontextprotocol.io/introduction', title: 'Model Context Protocol: Introduction' },
    ],
  },
  {
    slug: 'coding-benchmarks',
    title: 'SWE-bench, read carefully',
    track: 'tooling',
    oneLiner: 'A benchmark score tells you which harness was used, not which model to buy',
    prerequisites: [],
    difficulty: 2,
    devRelevance: 7,
    focus:
      'How SWE-bench Verified and the aider leaderboard are constructed, what they measure, contamination, and why scores do not transfer to your repo.',
    primarySources: [
      sweBenchPaper,
      { type: 'docs', url: 'https://www.swebench.com/', title: 'SWE-bench leaderboard' },
      { type: 'docs', url: 'https://aider.chat/docs/leaderboards/', title: 'Aider LLM leaderboards' },
    ],
  },

  // ── team-practice ─────────────────────────────────────────────────────────
  {
    slug: 'ai-code-team-norms',
    title: 'Team norms for AI-written code',
    track: 'team-practice',
    oneLiner: 'Disclose or not? The team that never decides ends up with the worst of both',
    prerequisites: ['reviewing-generated-code'],
    difficulty: 1,
    devRelevance: 8,
    focus:
      'The three decisions a team has to make: disclosure in PRs, who owns generated code, and what the reviewer is allowed to assume.',
    primarySources: [dora, { type: 'docs', url: 'https://survey.stackoverflow.co/2025', title: 'Stack Overflow Developer Survey 2025' }],
  },
  {
    slug: 'onboarding-through-an-agent',
    title: 'Onboarding through an agent',
    track: 'team-practice',
    oneLiner: 'New hires who ask the agent about the codebase learn faster and misunderstand more confidently',
    prerequisites: ['context-files'],
    difficulty: 1,
    devRelevance: 7,
    focus:
      'Using an agent to explore an unfamiliar codebase: what it gets right, where it hallucinates architecture, and how context files change that.',
    primarySources: [
      { type: 'repo', url: 'https://github.com/anthropics/claude-code', title: 'Claude Code repository' },
      { type: 'docs', url: 'https://docs.github.com/en/copilot', title: 'GitHub Copilot documentation' },
    ],
  },

  // ── economics ─────────────────────────────────────────────────────────────
  {
    slug: 'token-cost-of-a-feature',
    title: 'What a feature costs in tokens',
    track: 'economics',
    oneLiner: 'The expensive part of an agent run is the re-reading, not the writing',
    prerequisites: ['agent-loop-anatomy'],
    difficulty: 2,
    devRelevance: 8,
    focus:
      'Where tokens go in a real task: context loading, tool results, retries. Prompt caching, context compaction and the habits that halve the bill.',
    primarySources: [claudeCodeBestPractices, { type: 'docs', url: 'https://aider.chat/docs/', title: 'Aider documentation' }],
  },
  {
    slug: 'throughput-versus-review',
    title: 'Faster typing, slower merging',
    track: 'economics',
    oneLiner: 'Generating code ten times faster moved the queue, it did not shrink it',
    prerequisites: ['reviewing-generated-code'],
    difficulty: 2,
    devRelevance: 8,
    focus: 'Lead time versus coding time: what the delivery metrics say about AI-assisted teams and where the time actually goes now.',
    primarySources: [dora],
  },

  // ── risk ──────────────────────────────────────────────────────────────────
  {
    slug: 'insecure-generated-code',
    title: 'Security of generated code',
    track: 'risk',
    oneLiner: 'Assisted developers wrote less secure code and were more sure it was secure',
    prerequisites: ['reviewing-generated-code'],
    difficulty: 2,
    devRelevance: 8,
    focus:
      'What the studies actually found, the classes of vulnerability that generation favours, and the scanner-in-the-loop setup that catches them.',
    primarySources: [insecureCodePaper, { type: 'docs', url: 'https://semgrep.dev/docs/', title: 'Semgrep documentation' }],
  },
  {
    slug: 'prompt-injection-via-tools',
    title: 'Prompt injection through tool results',
    track: 'risk',
    oneLiner: 'The agent does whatever the web page it just read tells it to, unless you built the boundary',
    prerequisites: ['mcp-in-practice'],
    difficulty: 3,
    devRelevance: 9,
    focus:
      'How untrusted content reaches an agent through tool results (fetched pages, issues, files), what it can do with write access, and the mitigations that hold.',
    primarySources: [
      { type: 'blog', url: 'https://simonwillison.net/tags/prompt-injection/', title: 'Simon Willison: prompt injection' },
      { type: 'docs', url: 'https://modelcontextprotocol.io/introduction', title: 'Model Context Protocol: Introduction' },
    ],
  },
];
