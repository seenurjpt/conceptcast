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
| `/login` | The front door. Explains what the agent does, shows the pipeline, and signs you in with LinkedIn. Everything else redirects here until you do. |
| `/review` | The only screen that matters. Draft, research file and critique as three tabs, a live character meter, the hook as LinkedIn truncates it, and every source clickable with its fact count. Edit in place; approve (publish now or schedule), reject with a reason, rewrite with a chosen angle. Approve enables only after you scroll to the end of the draft. |
| `/backlog` | Runway stats, then the concept list with track, prerequisites (met/unmet), status, inline relevance, timeliness boost and kill notes. Add concepts, retire, generate now, preview the selector ranking, run the full pipeline. Accept or reject proposed concepts. |
| `/calendar` | Month grid plus scheduled and published lists. Reschedule, publish now, unschedule. |
| `/voice` | Paste 8–15 posts, extract a style guide (one Sonnet call), edit the guide and audience description. |
| `/analytics` | Engagement by track with comparative bars; per-post manual metrics entry ("how did this do?") or fetch from LinkedIn. |

### The mark

Three nodes on a rising path, the last one filled: the prerequisite graph the app turns on, where concepts unlock in order and the final one ships. It reads equally as a graph, a rising signal and a broadcast. [src/components/Logo.tsx](src/components/Logo.tsx) is the single source; node weights were tuned by rendering at 16px, where an even-weight version smears into one diagonal.

Icons are generated from that same geometry: `src/app/icon.svg` (brand blue on transparent, for modern browsers), `src/app/favicon.ico` (16/32/48 frames, white on a dark rounded tile so it reads on any browser chrome), `src/app/apple-icon.png`, and `public/icon-{192,512}.png` plus a separately padded `icon-maskable-512.png` for Android, wired up in [src/app/manifest.ts](src/app/manifest.ts).

The design system lives in [DESIGN.md](DESIGN.md) and [src/app/globals.css](src/app/globals.css): one accent colour used sparingly, pill buttons, 24px cards, a mono face on every number, and light and dark palettes that both pass WCAG AA on every surface. The theme follows your system preference and can be toggled in the nav.

## Sign in with LinkedIn

1. Create an app on the LinkedIn Developer Portal, add **Share on LinkedIn** (`w_member_social`) and **Sign In with LinkedIn using OpenID Connect** (`openid profile`). Add `LINKEDIN_REDIRECT_URI` to the app's authorised redirect URLs.
2. Fill `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI` in `.env.local`, then open the app. Every page redirects to `/login` until you sign in.
3. Your name and photo appear in the account menu, which also shows whether publishing is active and when the token expires. Tokens live in a single Mongo row; access tokens last 60 days and the daily job refreshes at day 50. When the refresh token (365 days) expires, a banner asks you to sign in again.

### The login gate

`src/middleware.ts` redirects every dashboard page to `/login` and answers every data route with a 401 unless the browser carries a valid session cookie, so a fresh browser never sees a draft. The cookie is an HMAC-signed timestamp (`src/lib/authCookie.ts`), valid for 30 days, signed with `SESSION_SECRET`. The OAuth routes, the Inngest endpoint and the cron endpoint stay public; the latter two carry their own signing key or shared secret.

**What this is and is not.** conceptcast is single-tenant by design (spec §4: one LinkedIn token, one row, no credentials collection). The gate gives the app a front door and keeps drafts off the screen until someone signs in. It is not multi-user access control: the stored tokens belong to the one installation, so anyone who can reach the deployment and complete sign-in ends up in the same workspace. If this ever serves more than one person, replace the cookie with real per-user sessions and scope every query by user.

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
src/middleware.ts      the login gate
src/lib/authCookie.ts  signed session cookie (HMAC, edge-safe)
src/app/               login · (dashboard)/{review,backlog,calendar,voice,analytics} · api/
scripts/               seed · draft · select · publish-due · timeliness · verify-sources · smoke-db
tests/                 node:test unit tests
```

Every Anthropic call logs token usage to `data/usage.jsonl` and the `usages` collection (attributed to the concept). Static prompts and the voice profile sit before a cache breakpoint so repeated calls hit the prompt cache.
