# AI Concept Agent — Technical Specification (v2)

An agent that works through a curated backlog of AI engineering concepts, researches each one against primary sources, and drafts deep technical explainers for your personal LinkedIn feed.

**Not a news bot.** News decays in 48 hours and every feed is already saturated with it. This posts mechanisms — how attention actually works, why your RAG pipeline retrieves garbage, what prompt caching does to your bill. That content compounds: it's still correct in a year, it gets saved and shared, and it positions you as an engineer rather than a commentator.

---

## 1. Scope

**In scope**
- A seeded, growing backlog of ~60 AI engineering concepts organised into tracks
- Prerequisite-aware selection so posts build on each other into coherent series
- Deep research against primary sources: papers, official docs, source code
- Drafts that always contain a mechanism, a tradeoff, or a number
- Self-critique against a technical-depth rubric
- Human review queue → approve / edit / reject
- Publish to your personal LinkedIn profile + scheduling
- Engagement feedback into future selection

**Out of scope — confirmed**
- Company Page posting (personal profile only)
- @mentions of people or companies (the Posts API doesn't support them anyway)
- News harvesting as the primary driver. News enters only as an optional *timeliness signal* on a concept already in the backlog — never as a topic in itself.
- Images, carousels, polls, articles, newsletters — none are supported by the LinkedIn API

**Audience:** working software engineers who build with AI but haven't gone below the API surface. Your natural readership. Write for the developer who has called an LLM API and wants to know what happened on the other side.

---

## 2. Architecture

```
                  ┌────────────────────────────────────────────┐
                  │  BACKLOG (seeded once, grows over time)    │
                  │  60 concepts · 7 tracks · prereq DAG       │
                  └────────────────┬───────────────────────────┘
                                   ▼
   Inngest cron   ┌────────────────────────────────────────────┐
   Mon/Thu 06:00 ►│  1. SELECTOR   Haiku 4.5                   │
                  │     eligible concepts → pick 1             │
                  │     (prereqs met · not covered · timely?)  │
                  └────────────────┬───────────────────────────┘
                                   ▼
                  ┌────────────────────────────────────────────┐
                  │  2. SOURCE RESOLVER                        │
                  │     concept → primary sources              │
                  │     paper · docs · repo · eng blog         │
                  └────────────────┬───────────────────────────┘
                                   ▼
                  ┌────────────────────────────────────────────┐
                  │  3. RESEARCHER  Sonnet 5 + web_search      │
                  │     → mechanism · numbers · gotchas        │
                  │     every fact carries a source URL        │
                  └────────────────┬───────────────────────────┘
                                   ▼
                  ┌────────────────────────────────────────────┐
                  │  4. WRITER    Sonnet 5 + voice profile     │
                  │     3 angles: mechanism / myth / tradeoff  │
                  └────────────────┬───────────────────────────┘
                                   ▼
                  ┌────────────────────────────────────────────┐
                  │  5. CRITIC    Sonnet 5 + depth rubric      │
                  │     one revision pass, or kill the draft   │
                  └────────────────┬───────────────────────────┘
                                   ▼
                  ┌────────────────────────────────────────────┐
                  │  6. REVIEW QUEUE  (you)                    │
                  └────────────────┬───────────────────────────┘
                                   ▼
                  ┌────────────────────────────────────────────┐
                  │  7. PUBLISH → LinkedIn /rest/posts         │
                  └────────────────┬───────────────────────────┘
                                   ▼
                  ┌────────────────────────────────────────────┐
                  │  8. METRICS (48h) → weights back to step 1 │
                  └────────────────────────────────────────────┘
```

Each box is an Inngest step. The big structural difference from a news agent: **the topic pool is finite, curated, and ordered.** You are not fighting an ingestion firehose. Most of the complexity moves out of harvesting and into research depth.

Cadence: 2 posts/week beats 5. These take real reading to produce and real attention to consume.

---

## 3. The concept backlog

This replaces the source-harvesting layer entirely. Seed it once from the appendix, then let it grow.

```ts
// concepts
{
  _id,
  slug: 'kv-cache',
  title: 'The KV cache',
  track: 'model-internals',
  oneLiner: 'Why the second token is 100x cheaper than the first',
  prerequisites: ['attention-mechanism', 'tokenization'],
  difficulty: 1 | 2 | 3,              // 1 = any dev, 3 = needs ML background
  primarySources: [
    { type: 'paper' | 'docs' | 'repo' | 'blog', url, title }
  ],
  devRelevance: number,               // 0-10, seeded by you, tuned by engagement
  status: 'backlog' | 'selected' | 'published' | 'retired',
  coveredAt: Date | null,
  publishedDraftId: string | null,
  timelinessBoost: number,            // 0-10, decays; set by news watcher
  createdAt
}
```

### Tracks

| Track | What it covers | Difficulty |
|---|---|---|
| `model-internals` | Tokenization, attention, KV cache, sampling, quantization, MoE, speculative decoding | 2–3 |
| `retrieval` | Embeddings, chunking, HNSW/IVF, hybrid search, reranking, why RAG fails | 1–2 |
| `agents` | Tool calling, ReAct, MCP, memory, orchestration, loop detection | 1–2 |
| `production` | Streaming, caching, retries, cost accounting, durable execution, structured outputs, observability | 1 |
| `evals` | LLM-as-judge, golden sets, regression testing prompts, grounding checks | 2 |
| `adaptation` | LoRA/QLoRA, distillation, when fine-tuning actually beats prompting | 3 |
| `security` | Prompt injection, indirect injection, tool scoping, sandboxing, exfiltration | 1–2 |

`production` is your highest-value track — it's where your existing MERN/Next.js credibility converts directly into authority, and almost nobody writes about it well. Weight it accordingly.

### Prerequisite DAG

`prerequisites` is what turns a list of posts into a series. The selector will not surface `reranking` until `embeddings` is published. Practically this means your feed reads as a curriculum, and people start following you *to get the next one* — which is the actual goal.

Validate the DAG for cycles at seed time. A simple topological sort on startup catches mistakes.

### Optional timeliness signal (not topic discovery)

One lightweight daily job scans a small set of RSS feeds and HN for AI keywords, then does a single Haiku call: *"Does any headline here relate to a concept in this list? Return concept slugs only."* Matches get `timelinessBoost = 8`, decaying by 2/day.

Effect: if a new model ships with a huge context window, `context-window-mechanics` jumps the queue. You still write the evergreen explainer — the news just decides *when*. This is the correct way to be timely without becoming a news account.

---

## 4. Data model (MongoDB)

```ts
// concepts — as above

// research — one per selected concept
{
  _id, conceptId,
  mechanism: string,              // the core "how it actually works", 200-400 words
  facts: [{
    text, sourceUrl, sourceTitle,
    type: 'number' | 'behaviour' | 'tradeoff' | 'gotcha',
    confidence: 'high' | 'medium'
  }],
  misconceptions: [{ belief, reality, sourceUrl }],
  codeExample: { language, snippet, explanation } | null,
  devImplication: string,         // what changes about how you build
  analogyCandidates: string[],
  fetchedAt
}

// drafts
{
  _id, conceptId, researchId,
  angle: 'mechanism' | 'misconception' | 'tradeoff' | 'debug-story',
  hook: string,                   // first 2 lines
  body: string,
  charCount: number,
  hashtags: string[],             // max 3
  critique: { score, issues: [], depthPassed: boolean, revisionOf: string|null },
  version: number,
  status: 'pending' | 'approved' | 'rejected' | 'published',
  editedByHuman: boolean,
  createdAt
}

// voiceProfile — singleton (unchanged from v1)
// publications — unchanged from v1
```

Since it's your account only, drop the `credentials` collection and the AES-256-GCM layer from v1. One LinkedIn token in an env var or a single-row config doc. Saves you a day.

**Indexes:** `concepts.status + track`, `concepts.slug` (unique), `drafts.status`, `publications.scheduledFor`.

---

## 5. The agent chain

### 5.1 Selector — Haiku 4.5

**Eligibility filter runs in code, not the LLM:**
```ts
eligible = concepts.filter(c =>
  c.status === 'backlog' &&
  c.prerequisites.every(p => publishedSlugs.has(p)) &&
  !recentlyCoveredTrack(c.track, 2)   // don't post 3 retrieval posts in a row
);
```

Then one Haiku call ranks the ~15 survivors:

```
You are picking the next topic for a technical LinkedIn post aimed at
working software engineers who build with AI but have not gone below
the API surface.

Recently published (do not repeat the same ground):
{last 10 titles + their engagement numbers}

Candidates:
{slug, title, oneLiner, track, difficulty, devRelevance, timelinessBoost}

Score each 0-10 on:
- teachability: is there a concrete mechanism to explain in 1400 characters?
- surprise: would a competent developer learn something they did not
  already assume from the title alone?
- applicability: does knowing this change a decision they make in code?

Return ONLY JSON: [{"slug","teachability","surprise","applicability","reasoning"}]
```

`surprise` is the important one. "What is RAG" scores 2. "Why your chunk overlap is silently duplicating context and inflating your bill" scores 9.

### 5.2 Source resolver

Before research, assemble grounding material in code:
1. Use `concept.primarySources` (seeded by hand — this is worth the effort)
2. `web_fetch` each URL, strip to text, cap at ~8k tokens each
3. If fewer than 2 sources resolve, let the researcher search to fill the gap

Hand-seeding primary sources is what makes the output better than a generic generator. For `lora`, seed the actual LoRA paper. For `prompt-caching`, seed the Anthropic docs page. For `hnsw`, seed the original paper plus the pgvector implementation notes.

### 5.3 Researcher — Sonnet 5 + `web_search`

**Output contract:**
```json
{
  "mechanism": "...",
  "facts": [{"text","sourceUrl","type","confidence"}],
  "misconceptions": [{"belief","reality","sourceUrl"}],
  "codeExample": {"language","snippet","explanation"},
  "devImplication": "...",
  "analogyCandidates": ["..."]
}
```

**Hard rules in the prompt:**
- Every fact must carry a `sourceUrl` drawn from the supplied documents or search results. If you cannot source it, omit it.
- `mechanism` must describe *how*, causally, not *what*. "Embeddings represent meaning as vectors" is a definition and is rejected. "Cosine similarity ignores magnitude, which is why an embedding of a 3-word query and a 300-word document can score identically" is a mechanism.
- At least 2 facts of type `number`. Concrete quantities are what make a technical post credible.
- `codeExample` must be under 8 lines and must run.

Drop `confidence: medium` facts before the writer sees them. A wrong number in front of your professional network is expensive; an omitted one costs nothing.

### 5.4 Writer — Sonnet 5

Generates 3 variants on different angles:

| Angle | Shape | Best for |
|---|---|---|
| `mechanism` | Here's what actually happens when you call X | model-internals, production |
| `misconception` | Most devs think X. Here's why that's wrong | retrieval, agents |
| `tradeoff` | X vs Y — the decision rule nobody states | production, adaptation |
| `debug-story` | A bug this concept explains, narrated | any track, difficulty 1 |

**Hard constraints:**
- 1,000–1,700 characters. Technical posts can run longer than news posts; there's more to say and the audience is more patient.
- Hook = first 2 lines. LinkedIn truncates near 210 characters, so the hook is the whole ad. It must state a specific, surprising, technical claim — never a question, never "let's talk about."
- Plain text. No markdown renders on LinkedIn. Do not use Unicode bold/italic substitution — it breaks screen readers and search indexing.
- Code snippets: max 6 lines, no indentation deeper than one level (LinkedIn collapses leading whitespace inconsistently). Often better to describe the call than to show it.
- Line break every 1–2 sentences.
- Max 3 hashtags, at the end.
- Close with the concrete implication for the reader's own code, not "what do you think?"
- No @mentions of any person or company.

Feed it your voice profile plus your 3 best-performing published posts as few-shot examples.

### 5.5 Critic — Sonnet 5

Scores 1–10. Below 7 triggers exactly one revision; still below 7, kill the draft and return the concept to `backlog` with a note. Shipping mediocre technical content is worse than shipping nothing, because being wrong in public in your own field is the specific risk here.

**Depth rubric — auto-fail conditions:**

| Check | Fails if |
|---|---|
| **Mechanism present** | The post defines a thing without explaining how it works |
| **Source grounding** | Any claim absent from `research.facts` |
| **Specificity** | No number, no named algorithm, no concrete tradeoff |
| **Surprise** | A competent developer could have written this from the title |
| **News drift** | The post is about an announcement, a release, or a company |
| **Correctness risk** | Any claim stated more confidently than its source supports |
| **Voice** | Reads as generic thought-leadership rather than the voice profile |
| **Slop markers** | "game-changer", "let that sink in", "here's the thing", "I was today years old", "🚀", one-word-per-line openings, em-dash pileups |
| **Length** | Outside 1,000–1,700 characters |

Add one comparative check: *"Is this structurally distinct from the last 10 published posts?"* Pass the last 10 hooks in. Homogenisation is the failure mode that kills these projects around week four.

Keep the rubric in `prompts/rubric.v2.md`, versioned, so you can iterate and compare.

---

## 6. Voice profile

One-time bootstrap, 30 minutes, highest leverage in the project.

1. Paste 8–15 posts you've written or admire into a setup screen
2. One Sonnet call extracts a style guide: sentence length, formality, opening patterns, closing patterns, vocabulary, list usage, first-person density, humour
3. Store as `voiceProfile.styleGuide`, inject into every writer call
4. Refresh monthly against your own top performers

Also store `audienceDescription` explicitly — "mid-level full-stack developers, mostly JS/TS, who use LLM APIs but haven't read a paper." The writer needs this to calibrate how much to assume.

---

## 7. Publishing — LinkedIn (personal profile)

### Access
Register an app on the LinkedIn Developer Portal and add the self-serve **Share on LinkedIn** product. That grants `w_member_social`, which publishes to the authenticated member's own feed. No Marketing Developer Platform partner approval needed — that queue exists only for company pages and posting on behalf of others, neither of which you want. Add `profile` and `openid` to fetch the member ID.

Constraints to plan around: access tokens expire after 60 days, refresh tokens after 365 days, there is no scheduling parameter in the API, and rate limits sit around 100 calls per day per member.

### Endpoint
`POST https://api.linkedin.com/rest/posts`

Older tutorials show the unversioned `/v2/ugcPosts` surface. It still works for own-feed posting, but `/rest/posts` is what LinkedIn actively maintains — build against it.

**Required headers on every request:**
```
Authorization: Bearer {access_token}
LinkedIn-Version: 202608          # YYYYMM
X-Restli-Protocol-Version: 2.0.0
Content-Type: application/json
```

LinkedIn cuts a new version monthly and supports each for a minimum of one year, so a hardcoded string goes stale. Env var + a calendar reminder at ~9 months.

**Body:**
```json
{
  "author": "urn:li:person:{memberId}",
  "commentary": "Your post text",
  "visibility": "PUBLIC",
  "distribution": {
    "feedDistribution": "MAIN_FEED",
    "targetEntities": [],
    "thirdPartyDistributionChannels": []
  },
  "lifecycleState": "PUBLISHED",
  "isReshareDisabledByAuthor": false
}
```

### The gotcha that will cost you an hour
A successful POST returns **201 with an empty body**. The post URN arrives in the `x-restli-id` response header, not in JSON. If your HTTP client discards headers you lose the ID of every post and can never edit, delete, or fetch metrics for it. Read it explicitly, persist to `publications.postUrn`.

### Escaping
`commentary` requires escaping of these characters: `( ) < > @ | { } [ ] ~ * _ \`. Write a small `escapeCommentary()` helper and unit-test it — unescaped parentheses in a code-adjacent post will 400 on you, and technical posts contain parentheses constantly. This bites people writing exactly the kind of content you're writing.

### Scheduling
No native support. Store `scheduledFor`, run an Inngest cron every 15 minutes that picks up due rows, or model each post as a durable `step.sleepUntil()`.

### Token refresh
Refresh proactively at day 50, not reactively on 401. Daily job checking `expiresAt`. If the refresh token has expired, show a re-auth banner.

---

## 8. Feedback loop

48h after publishing, fetch metrics into `publications.metrics`. This needs `r_member_social`, which is more restricted than the write scope — if you can't get it approved, add a manual "how did this do?" field in the dashboard. Manual numbers work fine at 2 posts/week.

Feed back in two places:
1. **Selector context** — last 10 posts with engagement, so it learns which tracks land
2. **`concept.devRelevance`** — nudge the score of every concept in a track up or down based on that track's rolling average

That's the whole learning loop. No fine-tuning, no vector store, just context.

---

## 9. API routes (Next.js App Router)

```
app/api/
├── inngest/route.ts
├── auth/linkedin/route.ts
├── auth/linkedin/callback/route.ts
├── concepts/route.ts                 # GET list, POST add to backlog
├── concepts/[slug]/route.ts          # PATCH relevance, retire
├── concepts/[slug]/generate/route.ts # POST — force-run pipeline now
├── drafts/route.ts                   # GET review queue
├── drafts/[id]/route.ts              # PATCH — human edit
├── drafts/[id]/approve/route.ts      # POST { scheduledFor? }
├── drafts/[id]/regenerate/route.ts   # POST { angle? }
├── voice/route.ts
└── publications/route.ts
```

**Screens, in order of importance:**
1. **Review Queue** — the draft, its sources as clickable links, edit-in-place, approve/reject. This is the only screen that matters.
2. **Backlog** — the concept list with track, prereqs, status. Add/reorder/retire.
3. **Calendar** — what's scheduled
4. **Voice setup** — one-time
5. **Analytics** — engagement by track

---

## 10. Repo structure

```
src/
├── app/
├── lib/
│   ├── concepts/
│   │   ├── seed.ts              # the appendix, as data
│   │   ├── dag.ts               # prereq validation + eligibility
│   │   └── timeliness.ts        # optional news→concept matcher
│   ├── agents/
│   │   ├── selector.ts
│   │   ├── researcher.ts
│   │   ├── writer.ts
│   │   └── critic.ts
│   ├── prompts/                 # .md files, versioned — NOT inline strings
│   ├── publishers/linkedin.ts
│   ├── anthropic.ts             # client, retry, token accounting
│   └── db/
└── inngest/functions/           # generate-post, publish-scheduled,
                                 # fetch-metrics, refresh-token, scan-timeliness
```

Prompts as loaded `.md` files. You'll iterate on them fifty times and you don't want that churn inside TSX diffs.

---

## 11. Environment

```
MONGODB_URI=
ANTHROPIC_API_KEY=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=
LINKEDIN_API_VERSION=202608
LINKEDIN_MEMBER_URN=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
CRON_SECRET=
```

---

## 12. Build order

| Phase | Scope | Time |
|---|---|---|
| **0** | Repo, Mongo, seed 20 concepts from the appendix, DAG validation | 2–3 h |
| **1** | Researcher + Writer as a **CLI script**. `npm run draft kv-cache` → prints a post. No UI, no DB writes. Iterate prompts until you'd actually publish the output. | 1–2 days |
| **2** | Add the Critic + depth rubric. Run both versions over 15 concepts, compare. | half day |
| **3** | Mongo persistence, source resolver, full 60-concept seed | 1 day |
| **4** | Review Queue UI with sources visible | 1 day |
| **5** | Selector + Inngest cron | half day |
| **6** | LinkedIn OAuth + publish + scheduler + escaping helper | 1 day |
| **7** | Metrics + feedback | half day |
| **8** | Timeliness scanner (optional) | half day |

**Phase 1 has no UI on purpose.** The hard part of this project is prompt quality. Build the dashboard first and you'll spend three days on a beautiful queue full of posts you'd never put your name on.

Concrete gate before Phase 3: generate 10 drafts, and ask whether you'd publish 7 of them unedited. If not, the problem is the prompts, and no amount of infrastructure fixes it.

---

## 13. Cost

Anthropic rates: Sonnet 5 at $2/$10 per million input/output tokens; Haiku 4.5 at $1/$5.

Per post, at 2 posts/week:
- Selector (Haiku, ~15k in / 2k out): ~$0.03
- Researcher (Sonnet, ~50k in with fetched sources / 5k out): ~$0.15
- Writer (Sonnet, 3 variants, ~15k in / 4k out): ~$0.07
- Critic (Sonnet, ~12k in / 3k out): ~$0.05

**≈ $0.30 per post → under $3/month.** Prompt caching on the voice profile and rubric (identical across every call) cuts it further. This is not a project where cost is a design constraint — spend the tokens on research depth.

---

## 14. Failure modes

1. **Depth collapse.** Posts drift toward definitions because definitions are easier to generate. Mitigation: the `mechanism` field is a hard schema requirement, and the critic auto-fails definitional posts.
2. **Homogenisation.** By week four every post has the same shape. Mitigation: rotate angles, and the critic's structural-distinctness check against the last 10 hooks.
3. **Confident wrongness.** The expensive failure. You are posting technical claims under your own name to an audience that includes people who interview you. Mitigation: mandatory source URLs, dropping medium-confidence facts, and sources visible in the review UI so you can actually verify before approving.
4. **The lazy-approve trap.** Mitigation: require a scroll to the bottom before the approve button enables. Slightly annoying by design.
5. **Backlog exhaustion.** 60 concepts at 2/week is ~7 months. Add a monthly job that proposes 10 new concepts from recent papers and docs, for you to accept or reject.
6. **Version header rot.** Set the reminder now.

---

## Appendix — Seed backlog

Sixty concepts to seed `concepts`. `→` marks prerequisites.

**model-internals**
1. `tokenization` — Why models can't count letters in "strawberry"
2. `bpe-merges` — How a tokenizer decides where words break → tokenization
3. `embeddings-geometry` — What a vector actually encodes
4. `attention-mechanism` — Query, key, value, in plain terms → embeddings-geometry
5. `kv-cache` — Why token 500 is cheaper than token 1 → attention-mechanism
6. `context-window-mechanics` — What actually limits it, and the quadratic cost → attention-mechanism
7. `positional-encoding` — How a model knows word order → attention-mechanism
8. `sampling-temperature` — Temperature, top-p, top-k, and when each matters
9. `logprobs` — The confidence signal most devs never read → sampling-temperature
10. `quantization` — int8, int4, and what precision you actually lose
11. `mixture-of-experts` — Why a 400B model can cost like a 40B one
12. `speculative-decoding` — Using a small model to make a big one faster → kv-cache
13. `context-rot` — Why accuracy drops as you fill the window → context-window-mechanics
14. `tokenizer-cost-asymmetry` — Why non-English text costs more → bpe-merges

**retrieval**
15. `vector-similarity` — Cosine vs dot product vs euclidean → embeddings-geometry
16. `chunking-strategies` — Fixed, recursive, semantic, and what each breaks
17. `chunk-overlap-tax` — The duplication nobody measures → chunking-strategies
18. `hnsw-index` — How approximate nearest neighbour search actually works → vector-similarity
19. `ivf-vs-hnsw` — Index selection as a real engineering decision → hnsw-index
20. `hybrid-search` — Why BM25 still beats embeddings on exact terms → vector-similarity
21. `reranking` — Cross-encoders and the two-stage retrieval pattern → hybrid-search
22. `lost-in-the-middle` — Position bias in retrieved context → context-rot
23. `rag-failure-modes` — The five ways your pipeline silently returns garbage → chunking-strategies, reranking
24. `contextual-retrieval` — Prepending context to chunks before embedding → chunking-strategies
25. `metadata-filtering` — Pre-filter vs post-filter and the recall cliff → hnsw-index
26. `embedding-drift` — What happens when you change embedding models → embeddings-geometry

**agents**
27. `function-calling-internals` — What the model actually emits when it "calls" a tool
28. `react-loop` — Reason, act, observe, and where it breaks → function-calling-internals
29. `tool-schema-design` — Why your descriptions matter more than your code → function-calling-internals
30. `mcp-architecture` — Transports, servers, and the standardisation problem → function-calling-internals
31. `agent-memory` — Short-term, long-term, and the summarisation tradeoff → context-window-mechanics
32. `loop-detection` — Stopping an agent that has convinced itself it's making progress → react-loop
33. `multi-agent-handoff` — When splitting agents helps and when it multiplies errors → react-loop
34. `agent-error-recovery` — Designing tools that fail informatively → tool-schema-design
35. `computer-use-constraints` — Why screen-driving agents are still brittle → react-loop

**production**
36. `streaming-sse` — Server-sent events end to end in Next.js
37. `prompt-caching` — The mechanics, the TTL, and the actual cost math
38. `cache-prefix-ordering` — Why your prompt order determines your bill → prompt-caching
39. `structured-outputs` — JSON mode vs tool-forcing vs constrained decoding
40. `retry-jitter` — Handling 429s without stampeding
41. `durable-llm-workflows` — Why multi-step LLM pipelines need durable execution
42. `idempotency-in-agents` — Preventing duplicate side effects on retry → durable-llm-workflows
43. `token-accounting` — Attributing cost per user, per feature
44. `llm-observability` — What a useful trace span looks like
45. `ttft-vs-total-latency` — Which one your users actually feel → streaming-sse
46. `byo-api-keys` — Architecture and encryption for user-supplied keys
47. `batch-api-economics` — When a 50% discount is worth the latency
48. `context-assembly` — Treating the prompt as a build artifact → cache-prefix-ordering
49. `model-routing` — Cheap model first, escalate on failure → token-accounting

**evals**
50. `llm-as-judge` — How it works and the biases it carries
51. `judge-position-bias` — Why order of options changes the verdict → llm-as-judge
52. `golden-datasets` — Building a regression suite for prompts
53. `prompt-regression-testing` — CI for non-deterministic systems → golden-datasets
54. `grounding-checks` — Programmatically detecting unsupported claims → llm-as-judge

**adaptation**
55. `lora` — Low-rank adaptation, explained without the linear algebra
56. `qlora` — Quantized fine-tuning on one GPU → lora, quantization
57. `finetune-vs-prompt` — The honest decision rule → lora
58. `distillation` — Training a small model on a big model's outputs

**security**
59. `prompt-injection` — Why it isn't solved and probably won't be
60. `indirect-injection` — The retrieved document that hijacks your agent → prompt-injection, rag-failure-modes
61. `tool-permission-scoping` — Least privilege for agents → tool-schema-design
62. `agent-exfiltration` — How a tool-using agent leaks data → indirect-injection
63. `code-sandboxing` — Running model-generated code without regret

Start with the `production` track. It's difficulty 1, it's where your existing experience shows, and it's the least well-covered lane on LinkedIn.
