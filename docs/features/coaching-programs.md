# Coaching Programs and Group Challenges

Lets a coach create a named coaching space scoped to a squad roster, and
opens each program's live board: its shared topic sprint (research, quests,
task routing, progress, notes), its friendly group-challenge standings, and
(once a member has a flowed practice round) their generated drill set.

- **Route:** `/coaching-programs`
- **Nav:** the global dock's Settings menu → **Coaching Programs**
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
      → buildCoachingProgramBoard({ program, topicSprint, challenges, contributions, winEvents, memberFlows })
                                                                  — round/coaching-program.ts
  → buildCoachingProgramSummaryText(board)  — round/coaching-program.ts
  → panel renders it as a status block

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

## Known gaps

- No known gaps remain for this idea.
