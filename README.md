# conceptcast

An agent that works through a curated backlog of AI engineering concepts, researches each against primary sources, drafts deep technical explainers, critiques them against a depth rubric, and queues them for your review before publishing to your personal LinkedIn profile. Full design in [SPEC.md](SPEC.md).

```
backlog (63 concepts, 7 tracks, prereq DAG)
  → selector (Haiku 4.5)     eligibility in code, editorial ranking by the model
  → source resolver          fetch hand-seeded primary sources, ~8k tokens each
  → researcher (Sonnet 5)    mechanism · sourced facts · misconceptions · code
  → writer (Sonnet 5)        3 angles, voice profile + few-shot from your best posts
  → critic (Sonnet 5)        depth rubric v2, one revision or kill
  → review queue (you)       edit, approve/schedule, reject, regenerate
  → LinkedIn /rest/posts     scheduled every 15 min, escaping, x-restli-id
  → metrics (48h)            engagement → selector context + track relevance
```

## Setup

```bash
npm install
cp .env.example .env.local      # fill MONGODB_URI and ANTHROPIC_API_KEY at minimum
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
| `/review` | The only screen that matters. Draft with live constraint check, hook-as-LinkedIn-shows-it, clickable sources, research file, critique. Edit in place; approve (publish now or schedule), reject with a reason, regenerate with a chosen angle. Approve enables only after you scroll to the end of the draft. |
| `/backlog` | Concept table with track, prerequisites (met/unmet), status, relevance (inline edit), timeliness boost, kill notes. Add concepts, retire, generate now, preview the selector, run the full pipeline. Accept/reject proposed concepts. |
| `/calendar` | Month grid + scheduled/published lists, reschedule, publish now, unschedule. LinkedIn connection status, connect/re-authorise, refresh, disconnect. |
| `/voice` | Paste 8–15 posts, extract a style guide (one Sonnet call), edit the guide and audience description. |
| `/analytics` | Engagement by track; per-post manual metrics entry ("how did this do?") or fetch from LinkedIn. |

## LinkedIn

1. Create an app on the LinkedIn Developer Portal, add **Share on LinkedIn** (`w_member_social`) and **Sign In with LinkedIn using OpenID Connect** (`openid profile`). Add `LINKEDIN_REDIRECT_URI` to the app's authorised redirect URLs.
2. Fill `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI` in `.env.local`, then click **Connect** on `/calendar`.
3. Tokens are stored in a single Mongo row. Access tokens last 60 days; the daily job refreshes at day 50. When the refresh token (365 days) expires, a banner asks you to re-authorise.

Posts go to `POST https://api.linkedin.com/rest/posts` with the `LinkedIn-Version` header from `LINKEDIN_API_VERSION`. The post URN is read from the `x-restli-id` response header and stored on the publication. `escapeCommentary()` handles the reserved characters `( ) < > @ | { } [ ] ~ * _ \` (unit-tested — technical posts are full of parentheses).

Metrics via the API need `r_member_social` (`LINKEDIN_EXTRA_SCOPES=r_member_social`). Without it, enter numbers by hand on `/analytics`; at two posts a week that is fine.

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
GET/POST   /api/concepts                    list · add to backlog (DAG re-validated)
GET/PATCH/DELETE /api/concepts/[slug]       detail · relevance/retire/note/sources · retire
POST       /api/concepts/[slug]/generate    force-run the pipeline now { angle?, force? }
GET        /api/drafts?status=pending       review queue
GET/PATCH  /api/drafts/[id]                 detail with sources · edit { body } or reject { status:'rejected', reason }
POST       /api/drafts/[id]/approve         { scheduledFor? } — omit to publish now
POST       /api/drafts/[id]/regenerate      { angle? } — rewrite from existing research
GET/PUT    /api/voice                       voice profile
POST       /api/voice/extract               { posts[] } → style guide
GET        /api/publications                calendar + per-track stats
PATCH/POST/DELETE /api/publications/[id]    reschedule or manual metrics · publish-now / fetch-metrics · unschedule
GET/POST   /api/proposals                   pending proposals · propose 10 now
POST       /api/proposals/[id]              { action: 'accept' | 'reject' }
POST       /api/pipeline/run                { dryRun? } — what the Mon/Thu cron does
GET        /api/auth/linkedin               start OAuth · /callback · /status (GET/POST refresh/DELETE)
GET        /api/cron/publish                fallback scheduler (CRON_SECRET)
GET/POST/PUT /api/inngest                   Inngest serve endpoint
```

## Repo layout

```
src/lib/concepts/      seed.ts (the appendix as data) · dag.ts (validation + eligibility) · timeliness.ts · proposals.ts
src/lib/agents/        selector.ts · researcher.ts · writer.ts · critic.ts
src/lib/prompts/       researcher.md · writer.md · critic.md · rubric.v2.md · reviser.md · selector.md · voice-extract.md · timeliness.md · propose.md
src/lib/pipeline/      generate.ts (orchestrator) · constraints.ts (machine checks)
src/lib/sources/       resolve.ts (fetch + strip + cap)
src/lib/publishers/    linkedin.ts (OAuth, /rest/posts, escaping, metrics)
src/lib/               anthropic.ts (client, JSON calls, usage accounting) · voice.ts · feedback.ts · publishing.ts
src/inngest/           client.ts · functions/
src/app/               review · backlog · calendar · voice · analytics · api/
scripts/               seed · draft · select · publish-due · timeliness · verify-sources · smoke-db
tests/                 node:test unit tests
```

Every Anthropic call logs token usage to `data/usage.jsonl` and the `usages` collection (attributed to the concept). Static prompts and the voice profile sit before a cache breakpoint so repeated calls hit the prompt cache.
