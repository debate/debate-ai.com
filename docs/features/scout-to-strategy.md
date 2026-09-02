# Scout-to-Strategy Workflow

Turns the existing opponent-scouting and judge-tendency profiles into a
deterministic case-choice/risk recommendation for an upcoming matchup — the
"🧭 Scout-to-Strategy Workflow" bullet in `TODO.md`'s Research Crowdsourcing
Organizer Features list.

- **Route:** `/strategy`
- **Nav:** the Tools page's Prep & Practice group; the Reason Editor's
  Workspace menu (`t strategy` in Ctrl/Cmd-Shift-Space's command palette)
- **Also mounted:** Coach hub → **Scouting** section (alongside
  `OpponentTeamProfilesPanel`/`JudgeProfilesPanel`)
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

A form to enter a matchup id, an optional opponent-team id and judge id
(looked up from the existing `opponentTeamProfiles.ts`/`judgeProfiles.ts`
stores), an optional "Our side" (Aff/Neg/Unspecified), and a list of case
options (one per line, `Name: tag, tag`). Building a recommendation appends
it to that matchup's history log — every recommendation ever built for a
matchup is kept, newest first, rather than the latest overwriting the prior
one. Each rendered entry shows:

- **Recommended case / case rankings** — every case option ranked safest
  (lowest opponent-tag overlap) first.
- **Judge adaptation notes** — concrete notes from the judge's tracked speed
  tolerance, theory receptiveness, side bias, and most-tagged paradigm.
- **Risk level and factors** — `low`/`medium`/`high`, with the specific
  factors behind it.

## Side-aware risk heuristic

`assessMatchupRisk` (in `round/scout-to-strategy.ts`) checks two side-linked
signals: whether the opponent has a strong recorded win rate on a side, and
whether the judge has a notable historical side bias. Supplying "Our side"
scopes both checks to `getLikelyOpponentSide(ourSide)` — the side the
opponent will actually run against us this round (debate is two-sided, so
it's always the other one) — instead of judging any side signal as
generically risky:

- An opponent's strong win rate specifically on the side they'll likely run
  against us (at least 2 recorded rounds on that side, ≥65% win rate) is
  flagged. Their record on the side they *won't* run against us is not.
- A judge's side bias toward the side the opponent will likely run against
  us is flagged. A bias toward *our own* side is favorable, not a risk
  factor.

Without "Our side," both checks fall back to their prior side-agnostic
behavior (any notable opponent side preference, or any notable judge side
bias, is flagged).

## Data flow

```
debate-data-sync/src/state/opponentTeamProfiles.ts   — persisted OpponentTeamProfile, by teamId
debate-speech-writer/src/state/judgeProfiles.ts       — persisted JudgeProfile, by judgeId

round/scout-to-strategy.ts
  → getLikelyOpponentSide(ourSide)             — the side the opponent will likely run against us
  → rankCaseOptions(caseOptions, opponentProfile)
  → assessMatchupRisk(opponentProfile, judgeProfile, ourSide)
  → buildJudgeAdaptationNotes(judgeProfile)
  → buildStrategyRecommendation(...)           — composes the above
  → buildStrategyRecommendationFromStores(...) — resolves opponentProfile/judgeProfile
                                                  by id from the persisted stores

state/strategyRecommendations.ts (localStorage: strategyRecommendations)
  → appendStrategyRecommendation / deleteStrategyRecommendation / deleteStrategyRecommendationsForMatchup
  → buildStrategyRecommendationsPanelView       — every recommendation grouped by matchup, newest-first
  → updateStrategyRecommendationAiCaseChoice    — sets aiCaseChoice on one persisted recommendation

state/savedStrategyRecommendations.ts / round/strategy-recommendations-client.ts
  → isValidStrategyRecommendationRecord         — shared request-body validator (also used by the API route)
  → listSavedStrategyRecommendations / saveStrategyRecommendationToAccount / deleteSavedStrategyRecommendationFromAccount

hooks/useStrategyRecommendations.ts
  → local-first history, merged with and best-effort synced to
    apps/debate-ai.com's /api/strategy-recommendations routes (D1's
    saved_strategy_recommendations table) when signed in — the standing
    "link user db SQL" account-sync convention every other history-log tool
    in this repo already follows

round/case-choice-ai.ts / round/case-choice-client.ts
  → buildCaseChoiceAiUserPrompt(...)           — composes case rankings + judge notes + risk into a prompt
  → requestCaseChoiceEvaluation(...)           — calls /api/reason-ai, parses the JSON reply

panels/StrategyPanel.tsx
  → apps/debate-ai.com/app/strategy/page.tsx        — mounts the panel as a route
  → apps/debate-ai.com/components/coach/CoachHub.tsx — mounts the panel in the Scouting section
```

## AI case-choice evaluation

`round/case-choice-ai.ts` builds a prompt from an already-built
`StrategyRecommendation`'s own case rankings (with each case's tags and
opponent-tag overlap score), judge adaptation notes, and risk level/factors,
asking the model for an actual strategic case-choice evaluation — one that
weighs a case's fit against the judge's tendencies and the matchup's risk
factors, not just the raw overlap score. `round/case-choice-client.ts` posts
that prompt to the existing `/api/reason-ai` proxy and parses the JSON
reply into a `CaseChoiceAiResult` (`recommendedCase`, `reasoning`, and a
per-case `caseAssessments` note).

`StrategyPanel.tsx`'s "Get AI case-choice evaluation" action calls this and
saves the result on that specific recommendation's `aiCaseChoice` via
`useStrategyRecommendations`'s `setAiCaseChoice` (keyed by the
recommendation's own `id`, not its matchup — a matchup can have several
history entries, each with its own independent AI evaluation), rendering it
alongside the deterministic recommendation.

## Recommendation history log

Idea's "a history log of past strategy recommendations per matchup"
follow-up: building a recommendation for a matchup that already has one no
longer overwrites it — `state/strategyRecommendations.ts#appendStrategyRecommendation`
appends a fresh entry (its own generated `id`) to that matchup's history
instead, mirroring `state/judgeDecisions.ts`'s exact append-only-log
pattern, including its `MAX_STRATEGY_RECOMMENDATIONS_PER_MATCHUP` (20)
per-matchup cap. `StrategyPanel` renders every matchup's recommendations
newest-first, with a "Clear" action per entry and a "Clear all history for
this matchup" bulk action per matchup.

## Account sync

`hooks/useStrategyRecommendations.ts` follows the same local-first,
account-merge-on-mount pattern as `useJudgeDecisions`/
`useCounselPanelAssessments`: recommendations stay in `localStorage` first
(fully usable signed out), and merge with `apps/debate-ai.com`'s
`/api/strategy-recommendations` routes (backed by D1's
`saved_strategy_recommendations` table) when signed in, so a team's
recommendation history follows them across devices. The panel's "Sign in to
sync…" / "…synced to your account." line reflects the hook's `synced` flag.

## Cross-tab live update

`StrategyPanel` previously read `buildStrategyRecommendationsPanelView` on
mount only, so a strategy recommendation built, re-evaluated, or cleared in
another browser tab left the panel showing a stale list until something
else forced a re-render. `useStrategyRecommendations` now subscribes to the
browser's `storage` event, which the spec fires only in *other* same-origin
tabs/windows, never the one that made the write. A pure helper,
`flow/live-update.ts`'s `isStrategyLiveUpdateStorageEvent`, checks whether
the event's `key` is `state/strategyRecommendations.ts`'s
`"strategyRecommendations"` or `null` (a `localStorage.clear()`); when it
is, the listener re-reads `buildStrategyRecommendationsPanelView()`. This
closes the matching entry in [`shared-flow-sync.md`](shared-flow-sync.md)'s
Known gap: "every other localStorage-backed panel in this repo still has no
cross-tab live-update mechanism." Vitest-covered in
`packages/debate-round/test/live-update.test.ts` (the one backing key, the
`null`-key clear-all case, and unrelated/substring-matching keys).
`useStrategyRecommendations.ts`'s own `storage`-listener wiring remains
intentionally untested, matching every other panel/hook in this repo whose
wiring is exercised only through the shared pure predicate's own tests.

No other follow-ups remain open on this idea.
