# Coaching Programs and Group Challenges

Lets a coach create a named coaching space scoped to a squad roster, and
opens each program's live board: its shared topic sprint (research, quests,
task routing, progress, notes), its friendly group-challenge standings, and
(once a member has a flowed practice round) their generated drill set.

- **Route:** `/coaching-programs`
- **Nav:** the Tools page's Coaching & Analytics group; the Reason Editor's
  Workspace menu (`t programs` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

A form to create a coaching space (name + comma-separated squad-roster member
IDs), then every persisted `CoachingProgramConfig` with a roster badge list
and a "Remove" action. Each program also has a "View board" action that opens
a topic input and a "Member flows" roster; once a topic is entered, the
program's live board renders as a status block:

- The coaching space's name and member count
- The topic sprint's status line (quest progress, task routing, active
  contributors, open follow-up notes)
- Each open group challenge's live standings line
- How many members currently have a generated drill set

The "Member flows" roster lets a coach record, per roster member, the round
workspace's currently selected flow as that member's practice round: enter a
side key (e.g. `A`/`N`) and click "Save current flow". A member with a
recorded flow shows a "Flow recorded" badge and gets a "Clear" action; the
board's per-member drill count updates the next time it's composed.

## Data flow

```
state/coachingPrograms.ts (localStorage: coachingPrograms)
  → buildCoachingProgramsPanelView()   — every persisted CoachingProgramConfig,
                                          name-sorted
  → panels/CoachingProgramsPanel.tsx   — renders the config form + list
  → apps/debate-ai.com/app/coaching-programs/page.tsx  — mounts the panel as a route

Opening a program's board (topic entered in the panel):
panels/CoachingProgramsPanel.tsx
  → buildPersistedCoachingProgramBoard(programId, topic, now)  — state/persistedCoachingProgramBoard.ts
      → getCoachingProgram(programId)                          — state/coachingPrograms.ts
      → readPersistedTopicSprintInputs(topic)                  — debate-card-search's state/topicSprints.ts
      → listGroupChallenges()                                  — debate-card-search's state/groupChallenges.ts
      → listContributions() (filtered to a submittedAt timestamp) — debate-card-search's state/contributions.ts
      → listChallengeWinEvents()                                — debate-card-search's state/challengeWinEvents.ts
      → buildCoachingProgramMemberFlows(program.memberIds)      — state/roundContributorFlows.ts (default; overridable)
      → buildCoachingProgramMemberPracticeRounds(program.memberIds) — state/roundContributorFlows.ts (default; overridable)
      → buildCoachingProgramBoard({ program, topicSprint, challenges, contributions, winEvents, memberFlows, memberPracticeRounds })
                                                                  — round/coaching-program.ts
  → buildCoachingProgramSummaryText(board)  — round/coaching-program.ts
  → panel renders it as a status block, plus a per-member Practice Round Simulator badge

Recording a member's flow ("Save current flow" in the panel's Member flows
roster):
panels/CoachingProgramsPanel.tsx (reads state/store.ts's useFlowStore directly)
  → buildAndSaveRoundContributorFlow(flow, roundId, contributorId, sideKey)
                                                                  — state/roundContributorFlows.ts
  → board recomposed via buildPersistedCoachingProgramBoard above
```

This closes the "(b-continued)" follow-up named under idea #13 ("Coaching
Programs and Group Challenges") in `TODO.md`: "wiring `CoachingProgramsPanel`
(in `debate-round`) to render a program's full `buildCoachingProgramBoard`
off this and the topic-sprint composition." `state/persistedCoachingProgramBoard.ts`
composes every one of `buildCoachingProgramBoard`'s inputs directly from its
own persisted store, mirroring `debate-card-search`'s `state/topicSprints.ts`
and `state/prepRooms.ts` "compose every input from its own store"
convention, so the panel doesn't need to assemble a topic sprint, challenge
roster, contribution feed, win-event list, or member-flow roster itself. The
new `state/roundContributorFlows.ts` supplies that last piece — a
`contributorId`-keyed store of each member's currently recorded, already-flowed
practice round (`roundId` + `sideKey` + `Flow`), which
`buildPersistedCoachingProgramBoard` reads by default (still overridable by
an explicit `memberFlows` argument, e.g. for tests). The panel's "Save
current flow" action is the one place this package reads the live round
workspace's `useFlowStore` directly (every other panel here is otherwise
self-contained), recording that flow against a chosen roster member and a
free-form side key.

`state/roundContributorFlows.ts`'s `buildCoachingProgramMemberPracticeRounds`
closes idea #13's remaining "(c) wiring a member's practice-round
setup/feedback (Practice Round Simulator) into the space" follow-up: a
roster member's recorded `roundId` already names the same id
`state/practiceRounds.ts` keys its `PracticeRoundRecord`s by, so this just
joins the two stores — no separate contributorId-keyed practice-round store
was needed. `buildPersistedCoachingProgramBoard` reads it by default (again
overridable by an explicit `memberPracticeRounds` argument), and
`round/coaching-program.ts`'s `buildCoachingProgramBoard` composes the result
into the board's new `memberPracticeRounds` map. The panel shows a
"Practice round recorded" (or "Practice round + feedback" once feedback has
been generated) badge per roster member alongside the existing "Flow
recorded" badge — a member starts a Practice Round Simulator session
separately at `/practice-round`, then records that same round's flow here to
surface it on the board.

## Roster analytics dashboard

Closes idea #13's own follow-up in `TODO.md`: "A coach-facing roster
analytics dashboard (completion rates, streaks, standings in one place)."
Before this, a coach had to visit `debate-team-collaboration`'s Group
Challenges panel (`/cards/group-challenges`) for a squad's challenge
standings and `debate-community`'s Quest Streaks panel (`/cards/streaks`)
for a contributor's daily-quest streak separately. The `/coaching-programs`
route now also renders a **Roster Analytics** section below the existing
program list/board panel: pick one of the coach's persisted coaching
programs and see every roster member's group-challenge standing (challenges
completed/participated, how many they're currently leading) and daily-quest
streak (current, longest, milestone badges) in one table, ranked by total
challenge-matching activity, then current streak length.

```
panels/CoachingProgramRosterAnalyticsPanel.tsx  (debate-community package)
  → buildCoachingProgramsPanelView()                         — debate-team-collaboration's state/coachingPrograms.ts (program picker)
  → buildPersistedCoachingProgramRosterAnalytics(programId, now) — state/coachingProgramRosterAnalytics.ts
      → getCoachingProgram(programId)                        — debate-team-collaboration's state/coachingPrograms.ts
      → buildPersistedGroupChallengeBoard(now)                — debate-team-collaboration's state/challengeWinEvents.ts
      → buildCoachingProgramRosterAnalytics(memberIds, challengeBoard, missionResultsForContributor, dayKey)
                                                                — lib/coaching-program-roster-analytics.ts
          → summarizeMemberChallengeStanding(contributorId, challengeBoard)
          → buildContributorQuestStreak(contributorId, results, dayKey) — lib/gamified-quests.ts
      → listDailyMissionResultsForContributor(contributorId)  — state/dailyMissionResults.ts
```

This composition lives in the `debate-community` package
(`packages/debate-contributor-progress`), not `debate-team-collaboration`
(the package the rest of Coaching Programs lives in), because
`debate-community` already depends on `debate-team-collaboration` (for
`daily-quests.ts`) — the reverse dependency would be circular. The pure
`lib/coaching-program-roster-analytics.ts` slice reuses
`debate-team-collaboration`'s already-computed `GroupChallengeProgress`
(no separate standings computation) and this package's own
`gamified-quests.ts` streak logic directly, mirroring this same package's
existing `unlock-streak-status.ts` "tie two ideas' pure slices together"
precedent. `apps/debate-ai.com/app/coaching-programs/page.tsx` mounts the
new panel alongside the existing `CoachingProgramsPanel`, so both are
reachable from the same already-linked `/coaching-programs` tool page — no
new nav/catalog entry was needed.

Also subscribes to the browser's `storage` event via `debate-research-evidence`'s
`state/live-update.ts`'s new `isCoachingProgramRosterAnalyticsLiveUpdateStorageEvent`,
so a challenge created/completed, a win recorded, or a mission result saved
in another browser tab refreshes the rendered roster here too.

## Known gaps

- The roster analytics table only covers group-challenge standings and
  daily-quest streaks — it doesn't yet fold in drill-completion rate or
  practice-round counts, both already shown per-member on the program's own
  board section above. A future run could widen the table to include them.
