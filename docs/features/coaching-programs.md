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
a topic input; once a topic is entered, the program's live board renders as a
status block:

- The coaching space's name and member count
- The topic sprint's status line (quest progress, task routing, active
  contributors, open follow-up notes)
- Each open group challenge's live standings line
- How many members currently have a generated drill set
- A "member drill assignments" list — which roster members are assigned to
  which `roundId`, with an "Unassign" action per entry — and an "Assign a
  round to a member" form (member select + round ID input) that resolves the
  assigned round's already-persisted drill set into that member's board entry

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
      → buildCoachingProgramBoard({ program, topicSprint, challenges, contributions, winEvents, memberFlows: [] })
                                                                  — round/coaching-program.ts
      → listRoundContributorAssignments(programId)              — state/roundContributorAssignments.ts
      → listDrillSets()                                         — state/drillSets.ts
      → resolveMemberDrillsFromAssignments(assignments, drillSets, program.memberIds)
                                                                  — round/coaching-program.ts
                                                                  (merged into board.memberDrills; a live
                                                                  memberFlow's drills win over an assigned
                                                                  round's for the same contributor)
  → buildCoachingProgramSummaryText(board)  — round/coaching-program.ts
  → panel renders it as a status block, plus a "member drill assignments" list with an
    "Assign a round to a member" action (member select + round ID) wired to
    assignRoundToContributor, and an "Unassign" action per assignment wired to
    unassignRoundFromContributor — both in state/roundContributorAssignments.ts
```

This closes the topic-sprint/group-challenge half of the "(b-continued)"
follow-up named under idea #13 ("Coaching Programs and Group Challenges") in
`TODO.md`: "wiring `CoachingProgramsPanel` (in `debate-round`) to render a
program's full `buildCoachingProgramBoard` off this and the topic-sprint
composition." A new `state/persistedCoachingProgramBoard.ts` composes every
one of `buildCoachingProgramBoard`'s inputs directly from its own persisted
store, mirroring `debate-card-search`'s `state/topicSprints.ts` and
`state/prepRooms.ts` "compose every input from its own store" convention, so
the panel doesn't need to assemble a topic sprint, challenge roster,
contribution feed, or win-event list itself.

## Known gaps

- None open — the "(b-continued)" follow-up under idea #13 in `TODO.md` is
  now fully closed. A member's drill set can also only come from an assigned
  round's already-*persisted* `DrillSetRecord` (via `state/drillSets.ts`,
  itself populated from `DrillSetsPanel`/`/drills`); there's still no UI path
  from this panel to generate a fresh drill set for an unflowed round — a
  coach assigns a round only after its drill set already exists.
