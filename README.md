# conceptcast

Name something you are learning (System design, Postgres internals, Kubernetes), pick a subtopic, and it researches that subtopic on the web, drafts a deep technical explainer, critiques it against a depth rubric, and hands it to you for review before anything reaches your personal LinkedIn profile. Full design in [SPEC.md](SPEC.md).

You drive it: open **Topics**, add a topic (it suggests about ten subtopics, or you add your own), open a subtopic, click **Write a post**. A few minutes later the draft opens for review.

```
you add a topic        "System design" → Haiku suggests ~10 subtopics; add your own any time
you pick a subtopic
  → source resolver    fetch any hand-seeded primary sources (user subtopics usually have none)
  → researcher         Sonnet 5 + web search: mechanism · sourced facts · misconceptions · code
  → writer             Sonnet 5: 3 angles, voice profile + your best posts as examples
  → critic             Sonnet 5: depth rubric v2, one revision or kill
  → you review         edit, approve, reject, rewrite with another angle
  → LinkedIn           /rest/posts, escaping, x-restli-id
```

Nothing runs on a schedule by default. The Inngest crons (`Mon/Thu` generation, 15-minute publishing, 48-hour metrics) stay in the repo but are inert without `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`, see [Scheduling](#scheduling-and-background-jobs-inngest) if you ever want them.

## Setup

```bash
npm install
cp .env.example .env.local      # fill MONGODB_URI at minimum; AI keys are added per user in Settings
npm run seed                    # validates the prerequisite DAG, upserts 63 concepts, syncs indexes
npm run dev                     # dashboard at http://localhost:3000
```

MongoDB: a local `mongod` or an Atlas URI. No mongod handy? `npm run smoke-db` boots an in-memory one to check the seed and models.

## Phase 1 loop: iterate prompts from the CLI

```bash
npm run draft -- prompt-caching                 # research → 3 variants → critique → (revision)
npm run draft -- kv-cache --angle debug-story   # force one angle
npm run draft -- streaming-sse retry-jitter     # several at once
```

Prints the winning draft, its critic score, auto-fails and cited sources; persists research + draft to Mongo (the draft appears in the review queue) and writes `data/drafts/<slug>.json`. Prompts live in [src/lib/prompts/](src/lib/prompts/) as versioned `.md` files. The gate before trusting the pipeline: generate 10 drafts and ask whether you would publish 7 unedited.

Other CLIs:

```bash
npm run select                  # eligibility filter + Haiku ranking, prints the table
npm run select -- --generate    # …and run the pipeline for the winner
npm run publish-due             # publish scheduled rows whose time has come
npm run timeliness              # one timeliness scan (feeds → Haiku → boosts)
npm run verify-sources          # check every seeded primary-source URL resolves
npm test                        # unit tests: escaping, DAG, constraints, angles, feeds
```

## Dashboard

| Screen | What it does |
|---|---|
| `/` | Public landing page: pitch, demo video (`public/showcase-conceptcast.mp4`), how it works, bring-your-own-key. Signed-in visitors are sent to Topics. |
| `/login` | Signs you in with LinkedIn (noindex; the landing page is the public page). Every dashboard page and data route redirects here until you do. |
| `/dashboard` | Home after sign-in. Greeting, a setup checklist until setup is done, headline numbers (published, awaiting review, subtopics to write, AI spend this month), drafts written per week, quality and engagement, the review queue, topic progress, and recently published and scheduled posts. |
| `/backlog`: **Topics** | Your main topics as cards (yours first, then the shared ones migrated from the old tracks) with how many subtopics are left to write. **Add topic** creates one and, by default, asks Haiku for about ten starter subtopics. Also: suggest what to write next, accept or reject proposed concepts from the news scan. |
| `/backlog/[topicId]` | One topic: its subtopics filtered by To write / In flight / Published / Removed, with search. **Write a post** runs the web-research pipeline on that subtopic and opens the draft. **Suggest subtopics** asks for more (deduplicated against what is there), **Add subtopic** takes a title and an optional focus, and user topics can be archived. |
| `/review`: **Drafts** | The screen that matters. Draft, research file and critique as three tabs, a live character meter, the hook as LinkedIn truncates it, and every source clickable with its fact count. Edit in place; approve (publish now or schedule), reject with a reason, rewrite with a chosen angle. Approve enables only after you scroll to the end of the draft. |
| `/calendar`: **Published** | What has gone out, plus anything scheduled for later. Reschedule, publish now, unschedule. |
| `/voice` | Paste 8–15 posts, extract a style guide (one Sonnet call), edit the guide and audience description. |
| `/analytics` | Engagement by track with comparative bars; per-post manual metrics entry ("how did this do?") or fetch from LinkedIn. |
| `/settings` | Your AI provider keys: Anthropic, OpenAI, Gemini. Add one or all three, pick which is tried first, replace or remove. A banner on every other page points here until at least one key is stored. |

### The mark

Three nodes on a rising path, the last one filled: the prerequisite graph the app turns on, where concepts unlock in order and the final one ships. It reads equally as a graph, a rising signal and a broadcast. [src/components/Logo.tsx](src/components/Logo.tsx) is the single source; node weights were tuned by rendering at 16px, where an even-weight version smears into one diagonal.

Icons are generated from that same geometry: `src/app/icon.svg` (brand blue on transparent, for modern browsers), `src/app/favicon.ico` (16/32/48 frames, white on a dark rounded tile so it reads on any browser chrome), `src/app/apple-icon.png`, and `public/icon-{192,512}.png` plus a separately padded `icon-maskable-512.png` for Android, wired up in [src/app/manifest.ts](src/app/manifest.ts).

The design system lives in [DESIGN.md](DESIGN.md) and [src/app/globals.css](src/app/globals.css): one accent colour used sparingly, pill buttons, 24px cards, a mono face on every number, and light and dark palettes that both pass WCAG AA on every surface. The theme follows your system preference and can be toggled in the nav.

## Landing page, SEO and performance

The landing page at `/` is rendered once at build time and served as a static file. Signed-in visitors are redirected to Topics by the middleware at the edge, from the session cookie alone, so the page never touches the database.

- **Search**: canonical URL, Open Graph and Twitter cards, a generated social image (`src/app/opengraph-image.tsx`), `robots.txt`, `sitemap.xml`, and JSON-LD for the site, the app, the video and the FAQ. The FAQ text and its structured data come from one array (`src/app/landing/faq.ts`). Set `NEXT_PUBLIC_SITE_URL` to your production origin; on Vercel it is picked up automatically.
- **Low-end devices**: the walkthrough video downloads only when it nears the viewport, plays only while visible, and is skipped entirely for reduced-motion, Save-Data and 2G visitors, who see the poster (`public/showcase-poster.jpg`). The hero glows are plain gradients rather than blur filters, and below-the-fold sections use `content-visibility: auto`.
- **Browsers**: Tailwind v4 targets Chrome and Edge 111+, Safari 16.4+ and Firefox 128+. The landing page is checked in Chromium, Firefox and WebKit.

## Sign in with LinkedIn

1. Create an app on the LinkedIn Developer Portal, add **Share on LinkedIn** (`w_member_social`) and **Sign In with LinkedIn using OpenID Connect** (`openid profile`). Add `LINKEDIN_REDIRECT_URI` to the app's authorised redirect URLs.
2. Fill `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI` in `.env.local`, then open the app. Every page redirects to `/login` until you sign in.
3. Your name and photo appear in the account menu, which also shows whether publishing is active and when the token expires. Tokens live in a single Mongo row; access tokens last 60 days and the daily job refreshes at day 50. When the refresh token (365 days) expires, a banner asks you to sign in again.

### The login gate

`src/middleware.ts` redirects every dashboard page to `/login` and answers every data route with a 401 unless the browser carries a valid session cookie, so a fresh browser never sees a draft. The cookie is an HMAC-signed timestamp (`src/lib/authCookie.ts`), valid for 30 days, signed with `SESSION_SECRET`. The OAuth routes, the Inngest endpoint and the cron endpoint stay public; the latter two carry their own signing key or shared secret.

**What this is and is not.** conceptcast is single-tenant by design (spec §4: one LinkedIn token, one row, no credentials collection). The gate gives the app a front door and keeps drafts off the screen until someone signs in. It is not multi-user access control: the stored tokens belong to the one installation, so anyone who can reach the deployment and complete sign-in ends up in the same workspace. If this ever serves more than one person, replace the cookie with real per-user sessions and scope every query by user.

Posts go to `POST https://api.linkedin.com/rest/posts` with the `LinkedIn-Version` header from `LINKEDIN_API_VERSION`. The post URN is read from the `x-restli-id` response header and stored on the publication. `escapeCommentary()` handles the reserved characters `( ) < > @ | { } [ ] ~ * _ \` (unit-tested, technical posts are full of parentheses).

Metrics via the API need `r_member_social` (`LINKEDIN_EXTRA_SCOPES=r_member_social`). Without it, enter numbers by hand on `/analytics`; for a handful of posts that is fine.

## Scheduling and background jobs (Inngest)

Functions live in [src/inngest/functions/](src/inngest/functions/) and are served at `/api/inngest`:

| Function | Trigger | Does |
|---|---|---|
| `generate-post` | Mon/Thu 06:00 (`GENERATE_CRON`) and `pipeline/generate.requested` | select → research → write → critique, as three checkpointed steps |
| `publish-scheduled` | every 15 min | publish due rows, emit `publication/published` |
| `fetch-metrics` | `publication/published` | sleep 48h, fetch engagement, apply feedback |
| `refresh-linkedin-token` | daily | refresh at day 50 |
| `scan-timeliness` | daily | decay boosts, scan feeds, boost matched concepts |
| `grow-backlog` | monthly | propose 10 new concepts; refresh the voice profile from top performers |

Local dev: `npm run inngest:dev` alongside `npm run dev` (the Inngest dev UI is at http://localhost:8288). Production: set `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`.

Without Inngest, the dashboard still works: generation runs inline in the request (`PIPELINE_MODE=inline`, the default), "approve & publish now" publishes inline, and `GET /api/cron/publish` with `Authorization: Bearer $CRON_SECRET` (or `npm run publish-due`) publishes scheduled rows from any external cron.

## API

```
GET/POST   /api/topics                      your topics with counts (migrates legacy tracks on first call) · { title, description?, suggest? } → topic + starter subtopics
GET/PATCH/DELETE /api/topics/[id]           topic + subtopics · rename/describe · archive (retires its unwritten subtopics)
POST       /api/topics/[id]/subtopics       { title, focus? }, add your own subtopic
POST       /api/topics/[id]/suggest         one Haiku call → { added, proposed, skipped }
GET/PUT    /api/user/keys                   which AI keys are stored · add/replace/remove keys, set preferred provider
GET/POST   /api/concepts                    list (filter ?topicId=) · add to backlog (DAG re-validated)
GET/PATCH/DELETE /api/concepts/[slug]       detail · relevance/retire/note/sources · retire
POST       /api/concepts/[slug]/generate    force-run the pipeline now { angle?, force? }
GET        /api/drafts?status=pending       review queue
GET/PATCH  /api/drafts/[id]                 detail with sources · edit { body } or reject { status:'rejected', reason }
POST       /api/drafts/[id]/approve         { scheduledFor? }, omit to publish now
POST       /api/drafts/[id]/regenerate      { angle? }, rewrite from existing research
GET/PUT    /api/voice                       voice profile
POST       /api/voice/extract               { posts[] } → style guide
GET        /api/publications                calendar + per-track stats
PATCH/POST/DELETE /api/publications/[id]    reschedule or manual metrics · publish-now / fetch-metrics · unschedule
GET/POST   /api/proposals                   pending proposals · propose 10 now
POST       /api/proposals/[id]              { action: 'accept' | 'reject' }
POST       /api/pipeline/run                { dryRun? }, what the Mon/Thu cron does
GET        /api/auth/linkedin               start OAuth · /callback · /status (GET/POST refresh/DELETE)
GET        /api/cron/publish                fallback scheduler (CRON_SECRET)
GET/POST/PUT /api/inngest                   Inngest serve endpoint
```

## Bring your own AI key

The app never pays for model calls. Each user adds their own key under **Settings**, and every stage (subtopic suggestions, research, writing, critique, voice extraction, proposals) runs on it:

- **Providers**: Anthropic, OpenAI and Google Gemini. Add any subset. Calls try the preferred provider first, then the others in that order; a 401 from one moves on to the next stored key. Model ids per provider and tier live in [src/lib/llm/models.ts](src/lib/llm/models.ts).
- **Web research works on all three**: Anthropic's web search tool, OpenAI's hosted web search, and Gemini's Google Search grounding. When searching, structured output is prompt-driven and validated with zod (one retry), because no provider combines native JSON mode with search.
- **Storage**: a key is checked against the provider's model-list endpoint when saved (no tokens spent), then AES-256-GCM encrypted with `KEY_ENCRYPTION_SECRET`. The API only ever returns the last four characters.
- **No key**: generation endpoints answer `412` with a message pointing to Settings, and the dashboard shows a banner.

`GET /api/user/keys` → `{ preferredProvider, active: [...], providers: { anthropic: { stored, hint }, … } }`.

## Post shape

Researched posts are short and term first: 600 to 1,000 characters (the writer aims for 700 to 900), opening with the concept's name and a plain-English definition, then the surprise, how it works in a few short lines, and what to change in your own code. The writer returns the `term` it used and the machine checks confirm the first line starts with it; the term is saved on the draft so edits on the Drafts page are checked against it. Paragraphs of three or more sentences are flagged. Rules live in [src/lib/prompts/writer.md](src/lib/prompts/writer.md) and [src/lib/pipeline/constraints.ts](src/lib/pipeline/constraints.ts); the critic's rubric exempts the shared term-first opening from its "same opening" check.

## Topics and subtopics

A **Topic** is a main subject you are learning (`topics` collection: title, slug, description, `ownerUserId` or `null` for shared, `origin: user | migrated`). A **subtopic** is a `Concept` row with a `topicId`; the old `track` field is kept and is `custom` for anything you add. Subtopics you add or that Haiku suggests carry only a title and a focus line; prerequisites, difficulty, relevance and hand-seeded sources still exist on the model but are hidden for them, and the researcher falls back to web search when a subtopic has no sources. The researcher and writer are told the main topic and your voice-profile audience so a "System design" post reads differently from a "Coding agents" one.

The seven legacy tracks (`coding-agents`, `workflow`, `codegen-quality`, `tooling`, `team-practice`, `economics`, `risk`) become shared topics the first time `GET /api/topics` runs; the migration is idempotent and attaches existing concepts by track. The suggestion prompt lives in [src/lib/prompts/suggest-subtopics.md](src/lib/prompts/suggest-subtopics.md), the service in [src/lib/topics/service.ts](src/lib/topics/service.ts).

## Announcing a topic

On any topic you created, **Announce** (or the one-time "Starting X? Tell your network" card) writes a short "I'm learning this in public" post: a 200 to 500 character body plus 3 to 5 hashtags. It names the topic, gives your reason if you supplied one, says you will share what you learn and get wrong, and ends on a question inviting advice. It deliberately lists no subtopics or study plan (people learn in any order, and listing them promised a syllabus and invited made-up claims); the machine checks reject any list in an announcement. Three optional fields: why you are starting, what you want to be able to do, and how often you will post. Each is used only if you give it; with no reason the hook is about the topic itself, and nothing about your background is made up. The prompt carries two short example posts as the quality bar.

It is one short model call with no research and no critic, then the usual machine checks in announcement mode (its own length range, up to 5 hashtags, no "Excited to share" style openers, must end on a question) and the usual Drafts review, watermark and publishing. Drafts carry a `kind` (`post` or `announcement`); an announcement has a `topicId` and no concept, research or critique, and publishing it does not touch any subtopic. Prompt: [src/lib/prompts/announce.md](src/lib/prompts/announce.md); logic: [src/lib/announce.ts](src/lib/announce.ts).

## Background research pool

Research is the slowest stage, so the app keeps the author's top subtopics researched ahead of time. Writing one of those skips straight to drafting.

- **Which subtopics.** The top 5 writable subtopics: in the backlog, prerequisites published, and not typed in by the author. Subtopics of topics you created rank before the shared seed, then by relevance plus any news boost, then oldest first. Subtopics you add yourself are researched when you click Write, at the usual speed.
- **When it runs.** No cron and no extra service. Routes that can change the top 5 (opening Topics or a topic, Write a post, AI suggestions, accepting a proposal, editing relevance or removing a subtopic) call `kickResearchPool()`, which uses Next.js `after()` to research after the response is sent, inside the same function. At most 2 run at once, and a new round only starts if it can finish inside Vercel's 300s limit; the next trigger picks up the rest.
- **No double research.** Every research run, background or Write, takes a lease on the subtopic (`researchState.lockedUntil`, 6 minutes). Write on a subtopic that is still being researched waits for that run. A run killed mid-way leaves no research behind, and its lease expires so the next trigger retakes it.
- **Reuse and staleness.** Write reuses the newest research if it is fresh: 3 days for news topics, 30 days otherwise. A draft the critic kills keeps its research, so retrying is fast.
- **Failures.** A failed background run is skipped for 24 hours and its slot goes to the next subtopic.
- **Size.** Settings → Background research (0 to 10, 0 is off), or `RESEARCH_POOL_SIZE` as the default. Nothing runs without an API key.

The rules are pure functions in [src/lib/research/pool.ts](src/lib/research/pool.ts) (unit-tested); the lease, waiting and background execution are in [src/lib/research/service.ts](src/lib/research/service.ts).

## Topics from the news

The beat is AI-driven development: how engineers build software with AI. Topics come from two places.

**The daily news scan** (`scan-news`, 07:00 IST, or **Scan the news** on the Topics page, or `npm run news:scan`) reads the beat feeds, keeps stories about building with AI, clusters them by story, and asks Haiku which clusters deserve a post. Keepers land in the proposal queue at the top of `/backlog` marked **news**, with the story links, the story's age and an expiry. Nothing generates a post until you accept. Accepting creates a backlog topic whose primary sources are the story links; the research stage cites them, and because the critic bans links in the body they never appear in the post itself. Unaccepted news proposals expire after `NEWS_PROPOSAL_TTL_DAYS` (default 4).

**A small evergreen seed** ([src/lib/concepts/seed.ts](src/lib/concepts/seed.ts), 14 concepts across `coding-agents`, `workflow`, `codegen-quality`, `tooling`, `team-practice`, `economics`, `risk`) so a quiet news day still has something to write. The old 63-concept model-internals seed is in git history.

```bash
npm run migrate:news-beat            # retire old-track topics, seed the new evergreen list (add --dry-run to preview)
npm run news:scan -- --dry-run       # fetch + cluster only, prints what the model would see
npm run news:scan                    # full scan, writes proposals
```

Feeds: `NEWS_FEEDS` (comma-separated RSS/Atom) overrides the defaults in [src/lib/news/feeds.ts](src/lib/news/feeds.ts). Tune this once you see what it surfaces. `NEWS_MIN_SCORE` (default 5) drops weak proposals; `NEWS_SCAN_ENABLED=false` keeps the job inert.

## Post generation pipeline (v2)

A second, angle-first pipeline that turns one topic into a publish-ready draft in the author's own voice. It runs only through Inngest, one run per user at a time, idempotent per user + topic + day.

```
POST /api/posts/generate { topicId }              → generation_runs row, event conceptcast/post.requested
  1 extract-angles   cheap    6 arguable claims → deterministic scorer → top one chosen
                              top score < 3 → run + draft stop at needs_author_input
  2 verify-anchors   cheap    skipped when every evidence item already has a number or named tool;
                              strips unverifiable numbers; zero evidence left → archetype falls back to concept-unpack
  3 write-draft      standard active voice profile + 3 exemplars (seeded by runId) + archetype slots + verified anchors
  4 critique         cheap    12 deterministic rules first (src/lib/critic/rules.ts), then one judgment call;
                              any failure → one revision with <revision_notes>, then status 'ready' either way
```

Every stage is its own Inngest step, so a retry never re-bills an earlier call. Every LLM call lands in `llm_calls` with model, tokens, latency and cost. Model IDs live in one file, [src/lib/llm/models.ts](src/lib/llm/models.ts); prompts are pure functions in [src/lib/prompts/](src/lib/prompts/) (`extractAngles.ts`, `writeDraft.ts`, `critique.ts`, `verifyAnchors.ts`, `voiceExtract.ts`).

**Before the first run**

1. `npm run seed:archetypes` upserts the six archetypes and creates the indexes.
2. Open `/exemplars` and paste at least three real posts per archetype you want to use. The pipeline refuses to write for an archetype with fewer than three and says so in the run error.
3. On `/voice`, add at least ten voice samples (posts, Slack messages, PR descriptions) and click **Extract profile**. The pipeline needs an active `voice_profiles` row. A new version is also extracted automatically after every 30 approved drafts.
4. Keys: there is no environment key. Every call uses a key the signed-in user stored under **Settings** (`PUT /api/user/keys { anthropicKey?, openaiKey?, geminiKey?, preferredProvider? }`), verified against the provider on save and AES-256-GCM encrypted with `KEY_ENCRYPTION_SECRET`. The preferred provider is tried first; a 401 moves on to the next stored key. See [Bring your own AI key](#bring-your-own-ai-key).

**Collections** (native driver, zod-validated, [src/lib/db/collections.ts](src/lib/db/collections.ts)): `users`, `voice_profiles`, `voice_samples`, `archetypes`, `exemplars`, `angles`, `post_drafts` (named so it does not collide with the legacy `drafts` collection), `generation_runs`, `llm_calls`. The user id is the connected LinkedIn member URN (`CONCEPTCAST_USER_ID` or `local` before sign-in); see [src/lib/session.ts](src/lib/session.ts).

```
POST   /api/posts/generate               { topicId, force? } → { runId }
GET    /api/posts/runs/[runId]           run status + draft + chosen angle once ready
GET    /api/posts/drafts?status=&page=   paginated drafts
GET/PATCH /api/posts/drafts/[id]         edit sections/hashtags → re-assemble, deterministic critic only
POST   /api/posts/drafts/[id]/approve    status 'approved' (drafts end here; posting is a non-goal)
GET/POST /api/voice/samples              { text, source }
POST   /api/voice/extract                {} → enqueue voice extraction ({ posts[] } keeps the legacy style guide)
GET/POST /api/exemplars                  DELETE /api/exemplars/[id]
GET/PUT /api/user/keys                   BYO provider keys
```

Tests: `npm test` runs the Vitest suite in `tests/pipeline/` (char counting, assembly, every critic rule, the scorer, and the pipeline with a mocked LLM client and recorded step order). `npm run test:legacy` runs the older `node:test` files.

## Repo layout

```
src/lib/concepts/      seed.ts (the appendix as data) · dag.ts (validation + eligibility) · timeliness.ts · proposals.ts
src/lib/topics/        service.ts (topics, subtopics, suggestions, track migration) · helpers.ts (slugs, dedupe)
src/lib/agents/        selector.ts · researcher.ts · writer.ts · critic.ts
src/lib/prompts/       researcher.md · writer.md · critic.md · rubric.v2.md · reviser.md · selector.md · suggest-subtopics.md · voice-extract.md · timeliness.md · propose.md
src/lib/pipeline/      generate.ts (orchestrator) · constraints.ts (machine checks)
src/lib/sources/       resolve.ts (fetch + strip + cap)
src/lib/publishers/    linkedin.ts (OAuth, /rest/posts, escaping, metrics)
src/lib/llm/           client.ts (per-user keys, provider fallback, structured output) · models.ts · providers/{anthropic,openai,gemini,verify}.ts
src/lib/               anthropic.ts (callJson: tier + usage accounting over lib/llm) · voice.ts · feedback.ts · publishing.ts
src/inngest/           client.ts · functions/
src/middleware.ts      the login gate
src/lib/authCookie.ts  signed session cookie (HMAC, edge-safe)
src/app/               login · (dashboard)/{backlog,backlog/[topicId],review,calendar,voice,analytics} · api/
scripts/               seed · draft · select · publish-due · timeliness · verify-sources · smoke-db
tests/                 node:test unit tests
```

Every Anthropic call logs token usage to `data/usage.jsonl` and the `usages` collection (attributed to the concept). Static prompts and the voice profile sit before a cache breakpoint so repeated calls hit the prompt cache.

## Author

Built by **Sunny Rajput** ([@seenurjpt](https://github.com/seenurjpt)).
