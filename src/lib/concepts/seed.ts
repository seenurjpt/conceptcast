export const TRACKS = [
  'model-internals',
  'retrieval',
  'agents',
  'production',
  'evals',
  'adaptation',
  'security',
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
  /** Appendix one-liner: the angle that makes this concept worth a post. */
  oneLiner: string;
  prerequisites: string[];
  /** 1 = any dev, 3 = needs ML background. */
  difficulty: 1 | 2 | 3;
  /** 0-10, seeded by hand, tuned by engagement later. Production weighted highest. */
  devRelevance: number;
  /** One-line steer for the researcher. */
  focus: string;
  /**
   * Phase 1 concepts hand-verified 2026-09-04; the rest verified by
   * scripts/verify-sources.ts (post-redirect URLs stored).
   */
  primarySources: PrimarySource[];
}

export const SEED_CONCEPTS: SeedConcept[] = [
  // ── production ────────────────────────────────────────────────────────────
  {
    slug: 'prompt-caching',
    title: 'Prompt caching',
    track: 'production',
    oneLiner: 'The mechanics, the TTL, and the actual cost math',
    prerequisites: [],
    difficulty: 1,
    devRelevance: 9,
    focus:
      'How provider-side prompt caching actually works (prefix matching, TTL, cache writes costing more than reads) and what it does to cost and latency.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://platform.claude.com/docs/en/build-with-claude/prompt-caching',
        title: 'Anthropic docs: Prompt caching',
      },
    ],
  },
  {
    slug: 'cache-prefix-ordering',
    title: 'Cache prefix ordering',
    track: 'production',
    oneLiner: 'Why your prompt order determines your bill',
    prerequisites: ['prompt-caching'],
    difficulty: 1,
    devRelevance: 9,
    focus:
      'Why the order of tools, system prompt, and messages determines cache hits, and how putting one dynamic value early silently invalidates everything after it.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://platform.claude.com/docs/en/build-with-claude/prompt-caching',
        title: 'Anthropic docs: Prompt caching',
      },
      {
        type: 'docs',
        url: 'https://developers.openai.com/api/docs/guides/prompt-caching',
        title: 'OpenAI docs: Prompt caching',
      },
    ],
  },
  {
    slug: 'streaming-sse',
    title: 'Streaming with server-sent events',
    track: 'production',
    oneLiner: 'Server-sent events end to end in Next.js',
    prerequisites: [],
    difficulty: 1,
    devRelevance: 8,
    focus:
      'What actually travels over the wire during LLM streaming: SSE framing, event types, why proxies buffer it, and what breaks reconnection.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://platform.claude.com/docs/en/build-with-claude/streaming',
        title: 'Anthropic docs: Streaming Messages',
      },
      {
        type: 'docs',
        url: 'https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events',
        title: 'MDN: Using server-sent events',
      },
    ],
  },
  {
    slug: 'structured-outputs',
    title: 'Structured outputs',
    track: 'production',
    oneLiner: 'JSON mode vs tool-forcing vs constrained decoding',
    prerequisites: [],
    difficulty: 1,
    devRelevance: 9,
    focus:
      'How constrained decoding guarantees schema-valid JSON at the token level, versus prompt-and-pray, and what schema features it cannot enforce.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://developers.openai.com/api/docs/guides/structured-outputs',
        title: 'OpenAI docs: Structured outputs',
      },
      {
        type: 'docs',
        url: 'https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview',
        title: 'Anthropic docs: Tool use overview',
      },
    ],
  },
  {
    slug: 'retry-jitter',
    title: 'Retries with jitter',
    track: 'production',
    oneLiner: 'Handling 429s without stampeding',
    prerequisites: [],
    difficulty: 1,
    devRelevance: 8,
    focus:
      'Why naive exponential backoff synchronizes clients into retry storms, and what full jitter does to total call completion time.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/',
        title: 'AWS: Exponential backoff and jitter',
      },
    ],
  },
  {
    slug: 'durable-llm-workflows',
    title: 'Durable LLM workflows',
    track: 'production',
    oneLiner: 'Why multi-step LLM pipelines need durable execution',
    prerequisites: [],
    difficulty: 1,
    devRelevance: 8,
    focus:
      'How step-based durable execution memoizes completed steps so a crash mid-chain does not re-run (and re-bill) earlier LLM calls.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://www.inngest.com/docs/learn/how-functions-are-executed',
        title: 'Inngest docs: How functions are executed',
      },
    ],
  },
  {
    slug: 'idempotency-in-agents',
    title: 'Idempotency in agent pipelines',
    track: 'production',
    oneLiner: 'Preventing duplicate side effects on retry',
    prerequisites: ['durable-llm-workflows'],
    difficulty: 1,
    devRelevance: 8,
    focus:
      'Why at-least-once delivery means every agent side effect needs an idempotency key, and how Stripe-style keys prevent double writes.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://stripe.com/blog/idempotency',
        title: 'Stripe: Designing robust and predictable APIs with idempotency',
      },
    ],
  },
  {
    slug: 'token-accounting',
    title: 'Token accounting',
    track: 'production',
    oneLiner: 'Attributing cost per user, per feature',
    prerequisites: [],
    difficulty: 1,
    devRelevance: 8,
    focus:
      'Where tokens actually go in a real request (system, tools, history, cache reads vs writes) and how to count them before sending.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://platform.claude.com/docs/en/build-with-claude/token-counting',
        title: 'Anthropic docs: Token counting',
      },
    ],
  },
  {
    slug: 'ttft-vs-total-latency',
    title: 'TTFT vs total latency',
    track: 'production',
    oneLiner: 'Which one your users actually feel',
    prerequisites: ['streaming-sse'],
    difficulty: 1,
    devRelevance: 8,
    focus:
      'Why time-to-first-token is dominated by prefill (compute-bound) while generation is memory-bandwidth-bound, and which one your UX actually depends on.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://www.databricks.com/blog/llm-inference-performance-engineering-best-practices',
        title: 'Databricks: LLM inference performance engineering',
      },
    ],
  },
  {
    slug: 'model-routing',
    title: 'Model routing',
    track: 'production',
    oneLiner: 'Cheap model first, escalate on failure',
    prerequisites: ['token-accounting'],
    difficulty: 1,
    devRelevance: 8,
    focus:
      'When routing easy requests to a small model beats always using the big one: the cost/quality/latency math and the misclassification risk.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://platform.claude.com/docs/en/about-claude/models/choosing-a-model',
        title: 'Anthropic docs: Choosing a model',
      },
    ],
  },
  {
    slug: 'llm-observability',
    title: 'LLM observability',
    track: 'production',
    oneLiner: 'What a useful trace span looks like',
    prerequisites: [],
    difficulty: 1,
    devRelevance: 7,
    focus:
      'What belongs in a trace span for an LLM call (model, tokens, cache stats, tool rounds) and how GenAI semantic conventions standardize it.',
    primarySources: [
      {
        type: 'repo',
        url: 'https://raw.githubusercontent.com/open-telemetry/semantic-conventions-genai/main/docs/gen-ai/gen-ai-spans.md',
        title: 'OpenTelemetry GenAI semantic conventions: inference spans',
      },
    ],
  },
  {
    slug: 'byo-api-keys',
    title: 'Bring-your-own API keys',
    track: 'production',
    oneLiner: 'Architecture and encryption for user-supplied keys',
    prerequisites: [],
    difficulty: 1,
    devRelevance: 7,
    focus:
      'How to store user-supplied LLM API keys without becoming a breach headline: envelope encryption, key rotation, and never logging the plaintext.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html',
        title: 'OWASP: Key management cheat sheet',
      },
    ],
  },
  {
    slug: 'batch-api-economics',
    title: 'Batch API economics',
    track: 'production',
    oneLiner: 'When a 50% discount is worth the latency',
    prerequisites: [],
    difficulty: 1,
    devRelevance: 7,
    focus:
      'How batch APIs price and schedule work, and the decision rule for which workloads tolerate a 24h window in exchange for half price.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://platform.claude.com/docs/en/build-with-claude/batch-processing',
        title: 'Anthropic docs: Batch processing',
      },
    ],
  },
  {
    slug: 'context-assembly',
    title: 'Context assembly',
    track: 'production',
    oneLiner: 'Treating the prompt as a build artifact',
    prerequisites: ['cache-prefix-ordering'],
    difficulty: 1,
    devRelevance: 8,
    focus:
      'Treating the final prompt as a deterministic build artifact: stable prefixes, ordered sections, and why ad-hoc string concatenation destroys cacheability and debuggability.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents',
        title: 'Anthropic: Effective context engineering for AI agents',
      },
    ],
  },

  // ── model-internals ───────────────────────────────────────────────────────
  {
    slug: 'tokenization',
    title: 'Tokenization',
    track: 'model-internals',
    oneLiner: 'Why models can’t count letters in "strawberry"',
    prerequisites: [],
    difficulty: 1,
    devRelevance: 6,
    focus:
      'How BPE merges bytes into tokens, and the concrete consequences: why numbers and code tokenize badly, why "strawberry" has three r problems.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://huggingface.co/learn/llm-course/chapter6/5',
        title: 'Hugging Face LLM course: Byte-pair encoding',
      },
    ],
  },
  {
    slug: 'bpe-merges',
    title: 'BPE merges',
    track: 'model-internals',
    oneLiner: 'How a tokenizer decides where words break',
    prerequisites: ['tokenization'],
    difficulty: 2,
    devRelevance: 5,
    focus:
      'The merge-table algorithm: how pair frequencies learned at training time decide where your words split, and why the same string tokenizes differently across models.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://huggingface.co/learn/llm-course/chapter6/5',
        title: 'Hugging Face LLM course: Byte-pair encoding',
      },
    ],
  },
  {
    slug: 'embeddings-geometry',
    title: 'Embedding geometry',
    track: 'model-internals',
    oneLiner: 'What a vector actually encodes',
    prerequisites: [],
    difficulty: 2,
    devRelevance: 7,
    focus:
      'What the vector space actually encodes: why cosine similarity discards magnitude, anisotropy, and why "similar" is not "related".',
    primarySources: [
      {
        type: 'docs',
        url: 'https://developers.google.com/machine-learning/crash-course/embeddings/embedding-space?hl=en',
        title: 'Google ML crash course: Embedding space',
      },
    ],
  },
  {
    slug: 'attention-mechanism',
    title: 'The attention mechanism',
    track: 'model-internals',
    oneLiner: 'Query, key, value, in plain terms',
    prerequisites: ['embeddings-geometry'],
    difficulty: 2,
    devRelevance: 6,
    focus:
      'Queries, keys, values as a soft lookup table: what the QK dot product buys, and why attention cost scales quadratically with sequence length.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://jalammar.github.io/illustrated-transformer/',
        title: 'The Illustrated Transformer',
      },
      {
        type: 'paper',
        url: 'https://arxiv.org/abs/1706.03762',
        title: 'Attention Is All You Need',
      },
    ],
  },
  {
    slug: 'kv-cache',
    title: 'The KV cache',
    track: 'model-internals',
    oneLiner: 'Why token 500 is cheaper than token 1',
    prerequisites: ['attention-mechanism'],
    difficulty: 2,
    devRelevance: 7,
    focus:
      'Why generation without a KV cache would be quadratic per token, how much memory the cache eats per token, and why long contexts are a RAM problem.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://huggingface.co/docs/transformers/kv_cache',
        title: 'Hugging Face docs: KV cache',
      },
      {
        type: 'blog',
        url: 'https://developer.nvidia.com/blog/mastering-llm-techniques-inference-optimization/',
        title: 'NVIDIA: LLM inference optimization',
      },
    ],
  },
  {
    slug: 'context-window-mechanics',
    title: 'Context window mechanics',
    track: 'model-internals',
    oneLiner: 'What actually limits it, and the quadratic cost',
    prerequisites: ['attention-mechanism'],
    difficulty: 2,
    devRelevance: 7,
    focus:
      'What a context window physically is (positional encoding range + KV memory), why quality degrades mid-context, and what long-context pricing reflects.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://platform.claude.com/docs/en/build-with-claude/context-windows',
        title: 'Anthropic docs: Context windows',
      },
    ],
  },
  {
    slug: 'positional-encoding',
    title: 'Positional encoding',
    track: 'model-internals',
    oneLiner: 'How a model knows word order',
    prerequisites: ['attention-mechanism'],
    difficulty: 3,
    devRelevance: 5,
    focus:
      'Why attention alone is order-blind, how positional encodings (sinusoidal, RoPE) inject order, and why they bound how far a context window can stretch.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://jalammar.github.io/illustrated-transformer/',
        title: 'The Illustrated Transformer',
      },
      {
        type: 'paper',
        url: 'https://arxiv.org/abs/1706.03762',
        title: 'Attention Is All You Need',
      },
    ],
  },
  {
    slug: 'sampling-temperature',
    title: 'Sampling and temperature',
    track: 'model-internals',
    oneLiner: 'Temperature, top-p, top-k, and when each matters',
    prerequisites: [],
    difficulty: 1,
    devRelevance: 7,
    focus:
      'What temperature mathematically does to the logit distribution, how top-p and top-k truncate it, and which combinations are redundant.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://huggingface.co/blog/how-to-generate',
        title: 'Hugging Face: How to generate text',
      },
    ],
  },
  {
    slug: 'logprobs',
    title: 'Logprobs',
    track: 'model-internals',
    oneLiner: 'The confidence signal most devs never read',
    prerequisites: ['sampling-temperature'],
    difficulty: 2,
    devRelevance: 6,
    focus:
      'What token logprobs expose about model confidence, and concrete uses: classification thresholds, hallucination flags, and cheap self-consistency checks.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://cookbook.openai.com/examples/using_logprobs',
        title: 'OpenAI cookbook: Using logprobs',
      },
    ],
  },
  {
    slug: 'quantization',
    title: 'Quantization',
    track: 'model-internals',
    oneLiner: 'int8, int4, and what precision you actually lose',
    prerequisites: [],
    difficulty: 2,
    devRelevance: 5,
    focus:
      'How weights get squeezed from fp16 to int8/int4 (scales, zero-points, outlier channels), and where quality actually degrades first.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://huggingface.co/docs/transformers/quantization/overview',
        title: 'Hugging Face docs: Quantization overview',
      },
    ],
  },
  {
    slug: 'mixture-of-experts',
    title: 'Mixture of experts',
    track: 'model-internals',
    oneLiner: 'Why a 400B model can cost like a 40B one',
    prerequisites: [],
    difficulty: 3,
    devRelevance: 5,
    focus:
      'How a router activates only a few experts per token, why parameter count and inference cost decouple, and the load-balancing failure modes.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://huggingface.co/blog/moe',
        title: 'Hugging Face: Mixture of Experts explained',
      },
    ],
  },
  {
    slug: 'speculative-decoding',
    title: 'Speculative decoding',
    track: 'model-internals',
    oneLiner: 'Using a small model to make a big one faster',
    prerequisites: ['kv-cache'],
    difficulty: 3,
    devRelevance: 5,
    focus:
      'How a draft model proposes tokens the big model verifies in one batched pass, why output distribution is provably unchanged, and where speedups collapse.',
    primarySources: [
      {
        type: 'paper',
        url: 'https://arxiv.org/abs/2211.17192',
        title: 'Fast Inference from Transformers via Speculative Decoding',
      },
      {
        type: 'blog',
        url: 'https://huggingface.co/blog/assisted-generation',
        title: 'Hugging Face: Assisted generation',
      },
    ],
  },
  {
    slug: 'context-rot',
    title: 'Context rot',
    track: 'model-internals',
    oneLiner: 'Why accuracy drops as you fill the window',
    prerequisites: ['context-window-mechanics'],
    difficulty: 2,
    devRelevance: 7,
    focus:
      'Measured degradation as input length grows even on trivial tasks: the evidence that context windows are not free, and what it means for prompt stuffing.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://research.trychroma.com/context-rot',
        title: 'Chroma research: Context rot',
      },
    ],
  },
  {
    slug: 'tokenizer-cost-asymmetry',
    title: 'Tokenizer cost asymmetry',
    track: 'model-internals',
    oneLiner: 'Why non-English text costs more',
    prerequisites: ['bpe-merges'],
    difficulty: 2,
    devRelevance: 5,
    focus:
      'Why the same sentence costs 2-4x more tokens in some languages: training-corpus skew in the merge table, and what it does to bills and context budgets.',
    primarySources: [
      {
        type: 'paper',
        url: 'https://arxiv.org/abs/2305.15425',
        title: 'Language Model Tokenizers Introduce Unfairness Between Languages',
      },
    ],
  },

  // ── retrieval ─────────────────────────────────────────────────────────────
  {
    slug: 'vector-similarity',
    title: 'Vector similarity metrics',
    track: 'retrieval',
    oneLiner: 'Cosine vs dot product vs euclidean',
    prerequisites: ['embeddings-geometry'],
    difficulty: 1,
    devRelevance: 7,
    focus:
      'Cosine vs dot product vs Euclidean: when they rank identically (normalized vectors) and when picking the wrong one silently reorders your results.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://www.pinecone.io/learn/vector-similarity/',
        title: 'Pinecone: Vector similarity explained',
      },
    ],
  },
  {
    slug: 'chunking-strategies',
    title: 'Chunking strategies',
    track: 'retrieval',
    oneLiner: 'Fixed, recursive, semantic, and what each breaks',
    prerequisites: [],
    difficulty: 1,
    devRelevance: 7,
    focus:
      'Why chunk size is a retrieval-precision vs context-coherence tradeoff, and how recursive/semantic splitters actually decide where to cut.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://www.pinecone.io/learn/chunking-strategies/',
        title: 'Pinecone: Chunking strategies',
      },
    ],
  },
  {
    slug: 'chunk-overlap-tax',
    title: 'The chunk overlap tax',
    track: 'retrieval',
    oneLiner: 'The duplication nobody measures',
    prerequisites: ['chunking-strategies'],
    difficulty: 1,
    devRelevance: 7,
    focus:
      'The arithmetic of overlap: how 20% overlap inflates storage, embedding spend, and duplicate retrievals, and when it buys you nothing.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://weaviate.io/blog/chunking-strategies-for-rag',
        title: 'Weaviate: Chunking strategies for RAG',
      },
    ],
  },
  {
    slug: 'hnsw-index',
    title: 'HNSW indexes',
    track: 'retrieval',
    oneLiner: 'How approximate nearest neighbour search actually works',
    prerequisites: ['vector-similarity'],
    difficulty: 2,
    devRelevance: 6,
    focus:
      'How the layered skip-list-like graph makes ANN search logarithmic, what efConstruction/M actually trade, and why HNSW lives in RAM.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://www.pinecone.io/learn/series/faiss/hnsw/',
        title: 'Pinecone: HNSW explained',
      },
      {
        type: 'paper',
        url: 'https://arxiv.org/abs/1603.09320',
        title: 'HNSW paper (Malkov & Yashunin)',
      },
    ],
  },
  {
    slug: 'ivf-vs-hnsw',
    title: 'IVF vs HNSW',
    track: 'retrieval',
    oneLiner: 'Index selection as a real engineering decision',
    prerequisites: ['hnsw-index'],
    difficulty: 2,
    devRelevance: 6,
    focus:
      'The memory/recall/build-time triangle: when inverted-file indexes beat graphs, and why "just use HNSW" fails past a certain corpus size.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://www.pinecone.io/learn/series/faiss/vector-indexes/',
        title: 'Pinecone: Vector indexes compared',
      },
    ],
  },
  {
    slug: 'hybrid-search',
    title: 'Hybrid search',
    track: 'retrieval',
    oneLiner: 'Why BM25 still beats embeddings on exact terms',
    prerequisites: ['vector-similarity'],
    difficulty: 1,
    devRelevance: 7,
    focus:
      'Why dense vectors miss exact identifiers and rare terms that BM25 nails, and how score fusion (RRF) combines the two without tuning.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://weaviate.io/blog/hybrid-search-explained',
        title: 'Weaviate: Hybrid search explained',
      },
    ],
  },
  {
    slug: 'reranking',
    title: 'Reranking',
    track: 'retrieval',
    oneLiner: 'Cross-encoders and the two-stage retrieval pattern',
    prerequisites: ['vector-similarity'],
    difficulty: 2,
    devRelevance: 7,
    focus:
      'Why a cross-encoder rereading query+document beats bi-encoder retrieval, and why you can only afford it on the top-k, not the corpus.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://www.pinecone.io/learn/series/rag/rerankers/',
        title: 'Pinecone: Rerankers',
      },
      {
        type: 'docs',
        url: 'https://docs.cohere.com/docs/rerank-overview',
        title: 'Cohere docs: Rerank overview',
      },
    ],
  },
  {
    slug: 'lost-in-the-middle',
    title: 'Lost in the middle',
    track: 'retrieval',
    oneLiner: 'Position bias in retrieved context',
    prerequisites: ['context-rot'],
    difficulty: 2,
    devRelevance: 7,
    focus:
      'The U-shaped accuracy curve over context position: why facts placed mid-context get missed, and what it means for how you order retrieved chunks.',
    primarySources: [
      {
        type: 'paper',
        url: 'https://arxiv.org/abs/2307.03172',
        title: 'Lost in the Middle: How Language Models Use Long Contexts',
      },
    ],
  },
  {
    slug: 'rag-failure-modes',
    title: 'RAG failure modes',
    track: 'retrieval',
    oneLiner: 'The five ways your pipeline silently returns garbage',
    prerequisites: ['chunking-strategies', 'reranking'],
    difficulty: 1,
    devRelevance: 8,
    focus:
      'The catalogued ways RAG pipelines fail silently — missing content, wrong chunk retrieved, context overflow, extraction failure — and how to detect each.',
    primarySources: [
      {
        type: 'paper',
        url: 'https://arxiv.org/abs/2401.05856',
        title: 'Seven Failure Points When Engineering a RAG System',
      },
    ],
  },
  {
    slug: 'contextual-retrieval',
    title: 'Contextual retrieval',
    track: 'retrieval',
    oneLiner: 'Prepending context to chunks before embedding',
    prerequisites: ['chunking-strategies'],
    difficulty: 2,
    devRelevance: 7,
    focus:
      'Why a chunk stripped of its document loses meaning, and how prepending LLM-generated context before embedding measurably cuts retrieval failures.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://www.anthropic.com/news/contextual-retrieval',
        title: 'Anthropic: Introducing contextual retrieval',
      },
    ],
  },
  {
    slug: 'metadata-filtering',
    title: 'Metadata filtering',
    track: 'retrieval',
    oneLiner: 'Pre-filter vs post-filter and the recall cliff',
    prerequisites: ['hnsw-index'],
    difficulty: 2,
    devRelevance: 6,
    focus:
      'Why filtering after ANN search can return far fewer results than you asked for, and how pre-filtering interacts badly with graph traversal.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://www.pinecone.io/learn/vector-search-filtering/',
        title: 'Pinecone: Vector search filtering',
      },
    ],
  },
  {
    slug: 'embedding-drift',
    title: 'Embedding drift',
    track: 'retrieval',
    oneLiner: 'What happens when you change embedding models',
    prerequisites: ['embeddings-geometry'],
    difficulty: 2,
    devRelevance: 6,
    focus:
      'Why vectors from different embedding models (or versions) live in incompatible spaces, and the reindex-everything consequence of any model swap.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://developers.openai.com/api/docs/guides/embeddings',
        title: 'OpenAI docs: Embeddings',
      },
    ],
  },

  // ── agents ────────────────────────────────────────────────────────────────
  {
    slug: 'function-calling-internals',
    title: 'Function calling internals',
    track: 'agents',
    oneLiner: 'What the model actually emits when it "calls" a tool',
    prerequisites: [],
    difficulty: 1,
    devRelevance: 8,
    focus:
      'What tool use actually is on the wire: the model emits structured JSON, your code executes it, and the loop is yours — the model never runs anything.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview',
        title: 'Anthropic docs: Tool use overview',
      },
    ],
  },
  {
    slug: 'react-loop',
    title: 'The ReAct loop',
    track: 'agents',
    oneLiner: 'Reason, act, observe, and where it breaks',
    prerequisites: ['function-calling-internals'],
    difficulty: 1,
    devRelevance: 7,
    focus:
      'The reason-act-observe cycle as the core agent pattern, why interleaved reasoning beats plan-then-execute, and the failure modes of each iteration.',
    primarySources: [
      {
        type: 'paper',
        url: 'https://arxiv.org/abs/2210.03629',
        title: 'ReAct: Synergizing Reasoning and Acting in Language Models',
      },
    ],
  },
  {
    slug: 'tool-schema-design',
    title: 'Tool schema design',
    track: 'agents',
    oneLiner: 'Why your descriptions matter more than your code',
    prerequisites: ['function-calling-internals'],
    difficulty: 1,
    devRelevance: 8,
    focus:
      'Why the tool description is a prompt, not documentation: how naming, parameter design, and error messages determine whether the model uses a tool correctly.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://www.anthropic.com/engineering/writing-tools-for-agents',
        title: 'Anthropic: Writing tools for agents',
      },
    ],
  },
  {
    slug: 'mcp-architecture',
    title: 'MCP architecture',
    track: 'agents',
    oneLiner: 'Transports, servers, and the standardisation problem',
    prerequisites: ['function-calling-internals'],
    difficulty: 2,
    devRelevance: 7,
    focus:
      'What MCP actually standardizes (tool discovery, transports, sessions) versus what it does not, and why N clients x M tools needed a protocol.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://modelcontextprotocol.io/docs/learn/architecture',
        title: 'MCP docs: Architecture',
      },
    ],
  },
  {
    slug: 'agent-memory',
    title: 'Agent memory',
    track: 'agents',
    oneLiner: 'Short-term, long-term, and the summarisation tradeoff',
    prerequisites: ['context-window-mechanics'],
    difficulty: 2,
    devRelevance: 7,
    focus:
      'Context window as working memory vs external stores as long-term memory, and what summarisation/compaction destroys when the window fills.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool',
        title: 'Anthropic docs: Memory tool',
      },
    ],
  },
  {
    slug: 'loop-detection',
    title: 'Loop detection',
    track: 'agents',
    oneLiner: 'Stopping an agent that has convinced itself it’s making progress',
    prerequisites: ['react-loop'],
    difficulty: 2,
    devRelevance: 7,
    focus:
      'How agents get stuck repeating near-identical actions, and concrete circuit breakers: step budgets, action-hash repetition checks, progress assertions.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://www.anthropic.com/engineering/building-effective-agents',
        title: 'Anthropic: Building effective agents',
      },
    ],
  },
  {
    slug: 'multi-agent-handoff',
    title: 'Multi-agent handoff',
    track: 'agents',
    oneLiner: 'When splitting agents helps and when it multiplies errors',
    prerequisites: ['react-loop'],
    difficulty: 2,
    devRelevance: 6,
    focus:
      'When an orchestrator-plus-subagents design beats one agent (parallel read-heavy work) and when it compounds errors (shared mutable state, lossy handoffs).',
    primarySources: [
      {
        type: 'blog',
        url: 'https://www.anthropic.com/engineering/multi-agent-research-system',
        title: 'Anthropic: How we built our multi-agent research system',
      },
    ],
  },
  {
    slug: 'agent-error-recovery',
    title: 'Agent error recovery',
    track: 'agents',
    oneLiner: 'Designing tools that fail informatively',
    prerequisites: ['tool-schema-design'],
    difficulty: 1,
    devRelevance: 7,
    focus:
      'Why a tool error message is a prompt for the retry: designing failures the model can act on, versus stack traces that send it into a doom loop.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://www.anthropic.com/engineering/writing-tools-for-agents',
        title: 'Anthropic: Writing tools for agents',
      },
    ],
  },
  {
    slug: 'computer-use-constraints',
    title: 'Computer use constraints',
    track: 'agents',
    oneLiner: 'Why screen-driving agents are still brittle',
    prerequisites: ['react-loop'],
    difficulty: 2,
    devRelevance: 5,
    focus:
      'Why pixel-level agents are slower and less reliable than API-level tools: screenshot latency, coordinate grounding, and the cases where they still win.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool',
        title: 'Anthropic docs: Computer use tool',
      },
    ],
  },

  // ── evals ─────────────────────────────────────────────────────────────────
  {
    slug: 'llm-as-judge',
    title: 'LLM-as-judge',
    track: 'evals',
    oneLiner: 'How it works and the biases it carries',
    prerequisites: [],
    difficulty: 2,
    devRelevance: 7,
    focus:
      'Using a model to grade model outputs: measured agreement with humans, and the systematic biases (position, verbosity, self-preference) it imports.',
    primarySources: [
      {
        type: 'paper',
        url: 'https://arxiv.org/abs/2306.05685',
        title: 'Judging LLM-as-a-Judge with MT-Bench',
      },
    ],
  },
  {
    slug: 'judge-position-bias',
    title: 'Judge position bias',
    track: 'evals',
    oneLiner: 'Why order of options changes the verdict',
    prerequisites: ['llm-as-judge'],
    difficulty: 2,
    devRelevance: 6,
    focus:
      'The measured effect of answer ordering on judge verdicts, and the mitigation: swap positions, run twice, count only consistent wins.',
    primarySources: [
      {
        type: 'paper',
        url: 'https://arxiv.org/abs/2306.05685',
        title: 'Judging LLM-as-a-Judge with MT-Bench',
      },
      {
        type: 'paper',
        url: 'https://arxiv.org/abs/2305.17926',
        title: 'Large Language Models are not Fair Evaluators',
      },
    ],
  },
  {
    slug: 'golden-datasets',
    title: 'Golden datasets',
    track: 'evals',
    oneLiner: 'Building a regression suite for prompts',
    prerequisites: [],
    difficulty: 2,
    devRelevance: 7,
    focus:
      'How to build a small labeled set from real failures, why 50 curated examples beat 5,000 synthetic ones, and what "looking at your data" concretely means.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://hamel.dev/blog/posts/evals/',
        title: 'Hamel Husain: Your AI product needs evals',
      },
    ],
  },
  {
    slug: 'prompt-regression-testing',
    title: 'Prompt regression testing',
    track: 'evals',
    oneLiner: 'CI for non-deterministic systems',
    prerequisites: ['golden-datasets'],
    difficulty: 2,
    devRelevance: 7,
    focus:
      'Running an eval suite on every prompt change like unit tests: assertion types that tolerate non-determinism, and when to gate deploys on scores.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://www.promptfoo.dev/docs/intro/',
        title: 'promptfoo docs: Introduction',
      },
    ],
  },
  {
    slug: 'grounding-checks',
    title: 'Grounding checks',
    track: 'evals',
    oneLiner: 'Programmatically detecting unsupported claims',
    prerequisites: ['llm-as-judge'],
    difficulty: 2,
    devRelevance: 7,
    focus:
      'Decomposing output into atomic claims and verifying each against source text: how factuality scoring works and what it costs per check.',
    primarySources: [
      {
        type: 'paper',
        url: 'https://arxiv.org/abs/2305.14251',
        title: 'FActScore: Fine-grained atomic evaluation of factual precision',
      },
    ],
  },

  // ── adaptation ────────────────────────────────────────────────────────────
  {
    slug: 'lora',
    title: 'LoRA',
    track: 'adaptation',
    oneLiner: 'Low-rank adaptation, explained without the linear algebra',
    prerequisites: [],
    difficulty: 3,
    devRelevance: 5,
    focus:
      'Why fine-tuning two small matrices instead of the full weights works: the low-rank update idea, the trainable-parameter arithmetic, and zero added inference latency.',
    primarySources: [
      {
        type: 'paper',
        url: 'https://arxiv.org/abs/2106.09685',
        title: 'LoRA: Low-Rank Adaptation of Large Language Models',
      },
    ],
  },
  {
    slug: 'qlora',
    title: 'QLoRA',
    track: 'adaptation',
    oneLiner: 'Quantized fine-tuning on one GPU',
    prerequisites: ['lora', 'quantization'],
    difficulty: 3,
    devRelevance: 4,
    focus:
      'How 4-bit base weights plus LoRA adapters fit 65B-parameter fine-tuning on a single GPU: NF4, double quantization, and the measured quality cost.',
    primarySources: [
      {
        type: 'paper',
        url: 'https://arxiv.org/abs/2305.14314',
        title: 'QLoRA: Efficient Finetuning of Quantized LLMs',
      },
    ],
  },
  {
    slug: 'finetune-vs-prompt',
    title: 'Fine-tune vs prompt',
    track: 'adaptation',
    oneLiner: 'The honest decision rule',
    prerequisites: ['lora'],
    difficulty: 3,
    devRelevance: 6,
    focus:
      'The honest decision rule: what fine-tuning can teach (form, style, narrow tasks) versus what it cannot (new knowledge), and why prompting wins more often than expected.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://developers.openai.com/api/docs/guides/fine-tuning',
        title: 'OpenAI docs: Fine-tuning',
      },
    ],
  },
  {
    slug: 'distillation',
    title: 'Distillation',
    track: 'adaptation',
    oneLiner: 'Training a small model on a big model’s outputs',
    prerequisites: [],
    difficulty: 3,
    devRelevance: 4,
    focus:
      'How soft targets from a teacher carry more signal than hard labels, and why distilled models keep surprising amounts of the teacher’s capability.',
    primarySources: [
      {
        type: 'paper',
        url: 'https://arxiv.org/abs/1503.02531',
        title: 'Distilling the Knowledge in a Neural Network',
      },
    ],
  },

  // ── security ──────────────────────────────────────────────────────────────
  {
    slug: 'prompt-injection',
    title: 'Prompt injection',
    track: 'security',
    oneLiner: 'Why it isn’t solved and probably won’t be',
    prerequisites: [],
    difficulty: 1,
    devRelevance: 8,
    focus:
      'Why instructions and data share one channel, why delimiter tricks and "ignore injections" system prompts fail, and what defense-in-depth actually looks like.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://simonwillison.net/series/prompt-injection/',
        title: 'Simon Willison: Prompt injection series',
      },
    ],
  },
  {
    slug: 'indirect-injection',
    title: 'Indirect prompt injection',
    track: 'security',
    oneLiner: 'The retrieved document that hijacks your agent',
    prerequisites: ['prompt-injection', 'rag-failure-modes'],
    difficulty: 2,
    devRelevance: 8,
    focus:
      'How content the model merely reads — a web page, a retrieved chunk, an email — becomes an instruction channel, and why RAG and browsing agents inherit it.',
    primarySources: [
      {
        type: 'paper',
        url: 'https://arxiv.org/abs/2302.12173',
        title: 'Not what you’ve signed up for: Indirect prompt injection',
      },
    ],
  },
  {
    slug: 'tool-permission-scoping',
    title: 'Tool permission scoping',
    track: 'security',
    oneLiner: 'Least privilege for agents',
    prerequisites: ['tool-schema-design'],
    difficulty: 1,
    devRelevance: 7,
    focus:
      'Applying least privilege to agents: read-only by default, human approval for writes, and why excessive agency is a named vulnerability class.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://owasp.org/www-project-top-10-for-large-language-model-applications/',
        title: 'OWASP Top 10 for LLM applications',
      },
    ],
  },
  {
    slug: 'agent-exfiltration',
    title: 'Agent exfiltration',
    track: 'security',
    oneLiner: 'How a tool-using agent leaks data',
    prerequisites: ['indirect-injection'],
    difficulty: 2,
    devRelevance: 7,
    focus:
      'The lethal trifecta — private data, untrusted input, and an outbound channel — and why any agent holding all three can be made to leak.',
    primarySources: [
      {
        type: 'blog',
        url: 'https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/',
        title: 'Simon Willison: The lethal trifecta',
      },
    ],
  },
  {
    slug: 'code-sandboxing',
    title: 'Code sandboxing',
    track: 'security',
    oneLiner: 'Running model-generated code without regret',
    prerequisites: [],
    difficulty: 2,
    devRelevance: 7,
    focus:
      'What isolation model-generated code actually needs: filesystem and network boundaries, resource limits, and why "it’s just Python" is how incidents start.',
    primarySources: [
      {
        type: 'docs',
        url: 'https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool',
        title: 'Anthropic docs: Code execution tool',
      },
    ],
  },
];

export function getConcept(slug: string): SeedConcept | undefined {
  return SEED_CONCEPTS.find((c) => c.slug === slug);
}
