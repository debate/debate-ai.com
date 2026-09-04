# Practice Drills

Shows every persisted "AI Drill Generator" `Drill` set, grouped by round —
overview, frontline, cross-ex, and collapse-scenario prompts derived from
that round's flow — with a "Clear" action per round.

- **Route:** `/drills`
- **Nav:** the Tools page's Prep & Practice group; the Reason Editor's
  Workspace menu (`t drills` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

Each persisted `DrillSetRecord` (keyed by `roundId` + the side the drills
were generated for) renders as its own card, sorted by `roundId` then
`sideKey` for a stable order. Inside a card, every drill shows a kind badge
and its prompt:

| Kind | Meaning |
| --- | --- |
| Overview | A whole-round overview prompt weighing every side currently represented in the flow |
| Frontline | A frontline-response prompt for a still-unanswered opposing argument |
| Cross-Ex | A cross-examination question for an unanswered argument |
| Collapse | A collapse-scenario recommendation for one of the opposing side's most vulnerable arguments |

## Difficulty rating and filtering

Every generated drill carries a `difficulty` rating (`easy`/`medium`/`hard`),
derived from the associated argument's `vulnerabilityScore` (see
`flow/response-outcome.ts`) via `flow/drill-generator.ts`'s
`vulnerabilityScoreToDifficulty`: a highly exposed argument — unanswered,
drawing opposing pressure, little same-side defense — makes for an "easy"
drill (there's obvious material to work with), while a well-defended
argument makes for a "hard" one. The whole-round overview drill, which has
no single associated argument, is always rated "medium". Each drill's badge
shows its difficulty next to its kind badge, and a "Difficulty" dropdown
above the drill list narrows every round's drills to one difficulty at a
time via `filterDrillsByDifficulty`.

## AI-generated practice script

Each drill has a "Get AI script" action (label becomes "Regenerate AI
script" once one exists). It calls `round/drill-script-client.ts`'s
`requestDrillScript` — a small `fetch` client that POSTs the drill's kind,
template prompt, and side to the existing `/api/reason-ai` Anthropic proxy
— and saves the reply on that drill's index via
`state/drillSets.ts`'s `saveDrillAiScript`. The result renders under the
template prompt line; a per-drill error message renders instead on
failure. This is an actual, ready-to-read practice script (e.g. the real
frontline response text), not another restatement of the template prompt.

## Generating a drill set

A "Generate drills for current round" form at the top of the panel derives
and persists a new `DrillSetRecord` from the round workspace's currently
selected flow (`state/store.ts`'s `useFlowStore` — the same mechanism
`CoachingProgramsPanel`'s "Save current flow" action uses). Given a typed
side (e.g. `aff`/`neg`), it calls `state/drillSets.ts`'s
`buildAndSaveDrillSet`, which composes the existing `buildDrillSet` +
`saveDrillSet` in one step; no new drill-generation logic. The action is
disabled with an inline hint when no flow is currently selected in the
workspace, and overwrites any existing drill set for that round, same as
`saveDrillSet`.

## Completion tracking

Each drill has a "Mark practiced"/"✓ Practiced" toggle button
(`state/drillSets.ts`'s `toggleDrillCompletion`, storing indexes into
`drills` on the record's `completedDrillIndexes` field), and each round
card shows a `MeterBar` progress meter — "N of M" drills marked practiced,
turning `positive` once every drill in the round is marked — driven by
`getDrillSetCompletionStats`. This closes the "completion tracking" half of
the two follow-ups named under the "📚 AI Drill Generator" bullet. "Drill
scheduling/reminders" is closed separately — see "Scheduling and reminders"
above.

## Progress Unlocks tier

A "Practice tier" card above the round list closes the other half of that
same follow-up: "tying completion into the Progress Unlocks tier system
(awarding tiers/badges for practiced drills)". `state/drillProgressUnlocks.ts`
sums `getDrillSetCompletionStats` across every persisted `DrillSetRecord`
into one total practiced-drill count, then feeds it straight into
`debate-card-search`'s `lib/progress-unlocks.ts#buildContributorUnlockStatus`
as a synthetic, otherwise-all-zero `ContributorStats` whose only non-zero
field is `completedTaskCount` — reusing that module's existing
"either-signal-qualifies" OR-path (a contributor reaches a tier via scored
contribution volume/quality **or** a completed-task count alone) rather than
adding a parallel drill-specific threshold table. The card shows the tier
badge, every tier badge earned so far (same names as the real Contribution
Leaderboard-backed roster: "Rising Researcher"/"Seasoned Contributor"/"Master
Researcher"), and a `MeterBar` toward the next tier with a "N more practiced
drills to reach \<tier\>" caption.

This status is deliberately local and drill-set-scoped, not a real
Contribution Leaderboard/Progress Unlocks roster row: it doesn't require (or
know) a real signed-in contributor id, and it isn't posted into
`state/contributions.ts`. A contributor's *real*, cross-tool unlock status
(`/cards/progress`) is unaffected by drill practice — see
`state/drillProgressUnlocks.ts`'s fileoverview for the full reasoning.

## Scheduling and reminders

Each drill has a "Review reminder" date field
(`state/drillSets.ts`'s `scheduleDrillReview`, storing a `YYYY-MM-DD` day
keyed by the drill's index on the record's `scheduledReviewAt` field) — the
"drill scheduling/reminders" follow-up named under the "📚 AI Drill
Generator" bullet. Setting a date persists immediately; a "Clear" button
next to the field removes it. There's no scheduled-job/push-notification
infrastructure in this repo (the same known gap `streakLapseReminders.ts`
documents), so the "reminder" is an in-app one: once the scheduled day
arrives (`isDrillReviewDue`, compared against the browser's local calendar
day), that drill gets a "Due" badge next to its kind/difficulty badges, and
its round card's heading gets an aggregate "N due for review" badge
(`getDueDrillIndexes`) — both surfaced the next time the panel is visited,
not pushed proactively.

## Account sync

Every drill set — including its AI scripts, completion state, and review
reminders — is now account-synced across devices for a signed-in user
(`hooks/useDrillSets.ts`), closing the "sharing the 'Practice tier' status
across devices for a signed-in user" follow-up named below. `DrillSetsPanel`
reads/writes exclusively through this hook, mirroring `useWordCountRounds`'s
local-first pattern:

- Local-first: `state/drillSets.ts`'s localStorage-backed functions stay the
  source of truth, so the panel is fully usable signed out.
- On mount, a one-time account merge (`GET /api/drill-sets`) reconciles
  local and remote drill sets by `roundId`: a remote-only record is adopted
  locally, a local-only record is best-effort pushed up, and a `roundId`
  present on both sides is resolved by comparing each side's `updatedAt` —
  the newer copy wins (`resolveDrillSetConflict`/`planDrillSetMerge`,
  mirroring `resolveWordCountRoundConflict`/`planWordCountRoundMerge`
  exactly).
- Every interactive mutation (generating a set, getting/regenerating an AI
  script, toggling completion, scheduling/clearing a review reminder,
  clearing a round) applies locally first, then best-effort pushes the
  freshly-stamped record to the account when signed in — a failed sync never
  blocks the local save.
- A new `updatedAt` field on `DrillSetRecord`, stamped by every mutating
  `state/drillSets.ts` function, drives the conflict resolution above.

Backed by a new `saved_drill_sets` D1 table (one row per `(user, roundId)`
pair, migration `apps/debate-ai.com/drizzle/0028_aspiring_human_fly.sql`)
plus `/api/drill-sets` (`GET` — every synced drill set in full) and
`/api/drill-sets/[roundId]` (`PUT` upsert, `DELETE`) routes, validated by
`state/savedDrillSets.ts#isValidDrillSetRecord` — same account-only shape
(401 without a session) as `/api/word-count-rounds`. The panel's header
shows a one-line "synced to your account" / "sign in to sync" status,
mirroring `WordCountRoundsPanel`'s own synced-status line.

## Data flow

```
state/drillSets.ts (localStorage: drillSets)
  → buildDrillSetsPanelView()      — sorts every persisted DrillSetRecord
                                      by roundId then sideKey
  → panels/DrillSetsPanel.tsx      — renders it, grouped by round
  → apps/debate-ai.com/app/drills/page.tsx  — mounts the panel as a route

Generating a round's drill set:
panels/DrillSetsPanel.tsx
  → buildAndSaveDrillSet(currentFlow, roundId, sideKey)  — state/drillSets.ts
    → buildDrillSet(currentFlow, sideKey)  — flow/drill-generator.ts
  → panel re-reads buildDrillSetsPanelView() to refresh

Clearing a round's drill set:
panels/DrillSetsPanel.tsx
  → deleteDrillSet(roundId)        — state/drillSets.ts
  → panel re-reads buildDrillSetsPanelView() to refresh

Generating a drill's AI script:
panels/DrillSetsPanel.tsx
  → requestDrillScript({ sideKey, drill })  — round/drill-script-client.ts
    → POST /api/reason-ai (system + user prompt from round/drill-script-ai.ts)
  → saveDrillAiScript(roundId, drillIndex, script)  — state/drillSets.ts
  → panel re-reads buildDrillSetsPanelView() to refresh

Toggling a drill's completion:
panels/DrillSetsPanel.tsx
  → toggleDrillCompletion(roundId, drillIndex)  — state/drillSets.ts
  → panel re-reads buildDrillSetsPanelView() to refresh
  → getDrillSetCompletionStats(record)  — derives the round's "N of M"
    MeterBar caption/ratio, recomputed on every render (not persisted)

Scheduling (or clearing) a drill's review reminder:
panels/DrillSetsPanel.tsx
  → scheduleDrillReview(roundId, drillIndex, dayKey | null)  — state/drillSets.ts
  → panel re-reads buildDrillSetsPanelView() to refresh
  → getDueDrillIndexes(record, todayKey)  — derives the drill/round "Due"
    badges, recomputed on every render (not persisted) against the
    browser's local calendar day

Rendering the "Practice tier" card (recomputed on every render, same as the
"N of M"/"Due" derivations above — nothing new is persisted):
panels/DrillSetsPanel.tsx
  → getTotalCompletedDrillCount(drillSets)  — state/drillProgressUnlocks.ts
    → getDrillSetCompletionStats(record) for every round  — state/drillSets.ts
  → buildDrillPracticeUnlockStatus(totalCompletedDrillCount)  — state/drillProgressUnlocks.ts
    → buildDrillPracticeContributorStats(...)  — synthetic ContributorStats
    → buildContributorUnlockStatus(stats)  — debate-card-search's lib/progress-unlocks.ts
```

Every drill-generation and persistence rule already existed and was
Vitest-covered; this feature closes follow-up (a), "a drill-panel UI that
reads/writes through the persistence store," named under the "📚 AI Drill
Generator" bullet in `TODO.md`, adding one small helper to
`state/drillSets.ts` — `buildDrillSetsPanelView`, which sorts
`listDrillSets`'s output for a stable panel display order — rather than
introducing new drill-generation logic. A later slice closes follow-up
(b), "an actual AI-generated (rather than templated) script," adding
`round/drill-script-ai.ts` and `round/drill-script-client.ts` plus the
panel's "Get AI script" action and `saveDrillAiScript`. Vitest-covered in
`packages/debate-round/test/drillSets.test.ts`,
`packages/debate-round/test/drill-script-ai.test.ts`, and
`packages/debate-round/test/drill-script-client.test.ts`. A later slice adds
`buildAndSaveDrillSet` to `state/drillSets.ts` and the panel's "Generate
drills for current round" form, closing the "no affordance in this panel to
generate a new drill set for a round" known gap — see "Generating a drill
set" above. Vitest-covered in `packages/debate-round/test/drillSets.test.ts`
(deriving and persisting a drill set from a flow, overwriting an existing
record for the same round, and `collapseLimit` passing through to
`buildDrillSet`).

A later slice adds the difficulty rating and filter dropdown described in
"Difficulty rating and filtering" above, closing the "difficulty rating with
filtering" follow-up named under the "📚 AI Drill Generator" bullet in
TODO.md's Research Crowdsourcing Organizer Features. Vitest-covered in
`packages/debate-round/test/drill-generator.test.ts`
(`vulnerabilityScoreToDifficulty`'s thresholds, `filterDrillsByDifficulty`,
and each drill builder's difficulty rating).

A later slice adds the completion tracking described in "Completion
tracking" above, closing the local-tracking half of the "completion
tracking tied into Progress Unlocks" follow-up named under the "📚 AI Drill
Generator" bullet. Vitest-covered in
`packages/debate-round/test/drillSets.test.ts` (`toggleDrillCompletion`
toggling a drill on/off, tracking multiple completed drills sorted by
index, leaving `drills`/`aiScripts`/other rounds' records untouched,
no-ops for an unknown roundId or an out-of-range drillIndex; and
`getDrillSetCompletionStats`'s zero/partial/full completion counts, its
handling of stale out-of-range indexes, and a zero — not `NaN` — ratio for
a record with no drills).

A later slice adds the scheduling/reminders described in "Scheduling and
reminders" above, closing the "drill scheduling/reminders" follow-up named
under the "📚 AI Drill Generator" bullet. Vitest-covered in
`packages/debate-round/test/drillSets.test.ts` (`scheduleDrillReview`
setting/overwriting/clearing a drill's schedule, leaving other drills'
schedules and every other field untouched, no-ops for an unknown roundId or
an out-of-range drillIndex; `isDrillReviewDue`'s past/today/future
comparisons; and `getDueDrillIndexes`'s due-list sorting and its handling of
a stale out-of-range scheduled index).

A later slice adds the Progress Unlocks tier card described in "Progress
Unlocks tier" above, closing the "tying completion into the Progress Unlocks
tier system" follow-up named under the "📚 AI Drill Generator" bullet.
Vitest-covered in `packages/debate-round/test/drillProgressUnlocks.test.ts`
(`getTotalCompletedDrillCount`'s empty/zero/summed/stale-index cases;
`buildDrillPracticeContributorStats`'s shape; `buildDrillPracticeUnlockStatus`'s
novice/apprentice/veteran/expert tier and badge boundaries at the default
thresholds, next-tier progress, and caller-supplied requirement tables; and
`buildDrillPracticeUnlockStatusFromStore`'s aggregation across multiple
persisted rounds).

A later slice adds the account sync described in "Account sync" above,
closing the "sharing the 'Practice tier' status across devices for a
signed-in user" follow-up named under the "📚 AI Drill Generator" bullet.
Vitest-covered: `packages/debate-round/test/drillSets.test.ts` gains
`saveDrillSet`/`saveDrillAiScript`/`toggleDrillCompletion`/
`scheduleDrillReview`'s `updatedAt` stamping, plus `adoptDrillSet`,
`resolveDrillSetConflict`, and `planDrillSetMerge` (mirroring
`wordCountRounds.test.ts`'s equivalent suites); new
`packages/debate-round/test/savedDrillSets.test.ts` covers
`isValidDrillSetRecord`'s structural validation (well-formed records, each
optional field, and each malformed shape); new
`packages/debate-round/test/drill-sets-client.test.ts` covers the
`/api/drill-sets` fetch client (list/save/delete, the `401`-to-`null` case,
and server error propagation). The hook (`hooks/useDrillSets.ts`) and API
routes stay untested at the unit level, matching every other synced field's
client/hook layer in this repo.

## Known gaps

No further follow-up is currently tracked for the "📚 AI Drill Generator"
bullet; a future run should pick a fresh next-step (e.g. feeding
practiced-drill counts into the real Contribution Leaderboard-backed
Progress Unlocks roster once this panel knows a real signed-in contributor
id — the "Practice tier" card itself is now account-synced, see "Account
sync" above, but it still feeds a synthetic, drill-set-scoped
`ContributorStats` rather than the real cross-tool roster) if one becomes
worth doing.
