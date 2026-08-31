# LLM Card Scoring

Scores a submitted debate-evidence card across five dimensions — relevance,
clarity, uniqueness, evidence quality, and usability — with a deterministic
heuristic, ranks every submitted card by overall score, flags likely
duplicates, and optionally requests a real Anthropic-backed qualitative
assessment (verdict + per-dimension notes) for any ranked card.

- **Route:** `/cards/scoring`
- **Nav:** the Tools page's Community & Progress group; the Reason Editor's
  Workspace menu (`t scoring` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

| Element | Source |
| --- | --- |
| Topic switcher + "Use tracked keywords" | Fills the keywords field from a topic's persisted tracked-argument checklist (`deriveArgBlockKeywordsForTopic`) |
| "Score card" form | Saves a `ScoredCard` (id, text, argument-block keywords, quality signal) |
| Ranked list | Every persisted card's heuristic `overallScore` and five per-dimension scores, descending |
| "Likely duplicate" badge | `isLikelyDuplicate` — uniqueness score below the near-duplicate threshold, checked against every other persisted card plus the real Shared Evidence Library corpus |
| "Get AI assessment" button | Requests a real Anthropic verdict + per-dimension notes for that card |
| AI assessment card | The persisted `overallScore`, one-sentence `verdict`, and a short note per dimension, once requested |

## Data flow

```
state/cardScores.ts (localStorage — submitted cards)
  → buildPersistedCardScoreRanking()
      → buildRealCorpusTexts()                 — every persisted Shared Evidence Library entry's text
      → rankCardScores()                       — lib/llm-card-scoring.ts (heuristic, pure)
  → panels/CardScoringPanel.tsx (ranked list + per-dimension breakdown)

Topic switcher / "Use tracked keywords" click:
  panels/CardScoringPanel.tsx
    → deriveArgBlockKeywordsForTopic()          — state/cardScores.ts
        → listTrackedArguments()                — state/trackedArguments.ts (localStorage)
        → deriveArgBlockKeywords()               — lib/llm-card-scoring.ts (pure)
    → fills the keywords field (still editable before submitting)

"Get AI assessment" click:
  panels/CardScoringPanel.tsx
    → requestCardScoringAiAssessment()         — lib/llm-card-scoring-client.ts
        → buildCardScoringAiUserPrompt()        — lib/llm-card-scoring-ai.ts (pure)
        → POST /api/reason-ai                   — apps/debate-ai.com/app/api/reason-ai/route.ts
            → https://api.anthropic.com/v1/messages
        → parseCardScoringAiResponse()          — lib/llm-card-scoring-ai.ts (pure)
    → saveAiAssessment()                        — state/aiCardAssessments.ts (localStorage)
  → panels/CardScoringPanel.tsx (renders the verdict + notes inline)
  → apps/debate-ai.com/app/cards/scoring/page.tsx (mounts the panel as a route)
```

The heuristic scorer (`lib/llm-card-scoring.ts`) is unchanged and always
runs — it needs no network call and no configuration. The AI assessment is
an additional, opt-in step per card: `/api/reason-ai` requires
`ANTHROPIC_API_KEY` to be configured server-side and the user to be signed
in (the same gate every other caller of that route goes through). Without
either, clicking "Get AI assessment" surfaces the proxy's error message
inline (e.g. "Sign in to use AI features." or "AI features are not
configured on this server.") rather than crashing the panel, and the
heuristic ranking above keeps working normally either way. A malformed or
non-JSON AI reply is handled the same way — `parseCardScoringAiResponse`
returns `null` rather than throwing, and the panel shows a per-card error.

See `packages/debate-card-search/test/llm-card-scoring-ai.test.ts` for
prompt-building and response-parsing coverage, and
`packages/debate-card-search/test/aiCardAssessments.test.ts` for the
persisted-store coverage.

## Cross-tab live update

`CardScoringPanel` subscribes to the browser's `storage` event, which fires
only in *other* same-origin tabs/windows, never the one that made the write.
A new pure helper, `state/live-update.ts`'s `isCardScoringLiveUpdateStorageEvent`,
checks whether the event's `key` is one of the panel's three backing stores
(`cardScores`, `aiCardAssessments`, `trackedArguments`) or `null` (a
`localStorage.clear()`); when it is, the panel re-runs its mount-time
refresh — recomputing the ranking, re-reading each ranked card's persisted
AI assessment, and refreshing the tracked-topic list — so a card scored, an
AI assessment requested, or a topic tracked in another tab shows up here
without a manual reload. This closes the "Every other localStorage-backed
panel in this repo still has no cross-tab live-update mechanism" Known gap
noted in [`shared-flow-sync.md`](shared-flow-sync.md), for this panel.
Vitest-covered in `packages/debate-card-search/test/live-update.test.ts`
(every backing-key match, the `null`-key clear-all case, an unrelated key,
and a same-prefix substring key).

## Known gaps

- The keywords field is still free-text — "Use tracked keywords" fills it
  from a topic's tracked-argument checklist, but a contributor can still
  type anything, and scoring a card for a topic with no tracked arguments
  yet still requires typing keywords by hand.
- The AI assessment is a second, independent qualitative signal shown
  alongside the heuristic score — nothing in the heuristic's own blended
  `overallScore` changes when an AI assessment is requested.
- Assessments are per-browser localStorage, not a shared team resource.
