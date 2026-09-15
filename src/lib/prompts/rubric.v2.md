# Scoring rubric for conceptcast drafts (v2)

A draft is a plain-text LinkedIn post teaching one AI engineering mechanism to mid-level full-stack developers who use LLM APIs but have not read a paper.

## Auto-fail conditions

Any one of these caps the draft below passing regardless of other merits. Record each triggered check.

| Check | Fails if |
|---|---|
| mechanism | The post defines a thing without explaining how it works. A reader finishes knowing *what* it is but not *why it behaves that way*. |
| grounding | Any claim, number, or behaviour in the post is absent from the supplied research facts. |
| specificity | No number, no named algorithm, no concrete tradeoff anywhere in the post. |
| surprise | A competent developer could write this post from the title alone. Nothing here forces an "oh, I didn't know that". |
| news-drift | The post is about an announcement, a release, or a company rather than a mechanism. |
| overclaiming | Any claim is stated more confidently than its source supports ("always", "never", "guarantees" where the research says "typically"). This is the correctness-risk check. |
| voice | Reads as generic thought-leadership rather than the supplied voice profile. |
| slop | Contains "game-changer", "let that sink in", "here's the thing", "I was today years old", any emoji, a one-word-per-line dramatic opening, or an em-dash pileup (three or more em-dashes in one paragraph). |
| length | Under 1,000 or over 1,700 characters. |
| distinctness | Structurally the same as one of the last ten published posts: same opening move, same skeleton, same closing pattern. |

## Scoring 1–10

Score the draft as a whole. Anchors:

- **9–10** — The hook alone teaches something. The causal chain is complete and correct. Every claim is grounded. A senior engineer would repost it without embarrassment. The closing implication is genuinely actionable.
- **7–8** — Publishable. Mechanism explained causally, at least one strong specific, grounded throughout, decent hook, concrete close. Minor flatness or one slightly soft transition allowed.
- **5–6** — Right shape, wrong depth. The mechanism is gestured at rather than walked through, or the hook states a fact without surprise, or the close is vague ("keep this in mind!"). Not publishable as-is.
- **3–4** — Reads like content marketing. Generic claims, missing causality, adjectives where numbers should be.
- **1–2** — Auto-fail territory: hallucinated claims, news drift, slop phrases, or badly off-length.

## What separates 7 from 6 (the passing line)

- The post answers "why" at least one level deeper than its own headline claim.
- At least one number or named algorithm from the research survives into the post.
- The reader's next action is specific enough to grep their codebase for.
- Reading the hook, a developer who already knows the concept would still expect to learn something from the rest.
