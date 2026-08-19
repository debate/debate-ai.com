# Scout-to-Strategy Workflow

Turns the existing opponent-scouting and judge-tendency profiles into a
deterministic case-choice/risk recommendation for an upcoming matchup — the
"🧭 Scout-to-Strategy Workflow" bullet in `TODO.md`'s Research Crowdsourcing
Organizer Features list.

- **Route:** `/strategy`
- **Also mounted:** Coach hub → **Scouting** section (alongside
  `OpponentTeamProfilesPanel`/`JudgeProfilesPanel`)
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

A form to enter a matchup id, an optional opponent-team id and judge id
(looked up from the existing `opponentTeamProfiles.ts`/`judgeProfiles.ts`
stores), an optional "Our side" (Aff/Neg/Unspecified), and a list of case
options (one per line, `Name: tag, tag`). Building a recommendation persists
and renders:

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
  → saveStrategyRecommendation / deleteStrategyRecommendation / buildStrategyRecommendationsPanelView
  → saveStrategyRecommendationAiCaseChoice — sets aiCaseChoice on a matchup's stored record

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
saves the result on `StrategyRecommendationRecord.aiCaseChoice` via
`saveStrategyRecommendationAiCaseChoice`, rendering it alongside the
deterministic recommendation. No follow-ups remain open on this idea.
