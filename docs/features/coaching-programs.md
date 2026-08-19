# Coaching Programs and Group Challenges

Lets a coach create a named coaching space scoped to a squad roster, and
opens each program's live board: its shared topic sprint (research, quests,
task routing, progress, notes), its friendly group-challenge standings, and
(once a member registers an already-flowed practice round) their generated
drill set.

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

Below the status block, a "Member practice flows" section lists every roster
member with:

- Their registration status — no round registered, a registered round that
  hasn't been flowed yet ("not flowed yet"), or a registered, resolved round
  ("drills ready")
- A small form (round id + side) to register or replace which already-flowed
  round is theirs, and a "Clear" action once one is registered

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
      → buildMemberPracticeFlowsForRoster(program.memberIds)     — state/memberPracticeFlows.ts (see below)
      → buildCoachingProgramBoard({ program, topicSprint, challenges, contributions, winEvents, memberFlows })
                                                                  — round/coaching-program.ts
  → buildCoachingProgramSummaryText(board)  — round/coaching-program.ts
  → panel renders it as a status block

Registering a member's practice flow (round id + side entered in the panel):
panels/CoachingProgramsPanel.tsx
  → saveMemberPracticeFlow({ contributorId, roundId, sideKey })  — state/memberPracticeFlows.ts
  → panel re-composes the board (above), which re-reads this mapping

Resolving a registered round to its actual flowed content:
state/memberPracticeFlows.ts's buildMemberPracticeFlowsForRoster / resolveFlowForRound
  → reads localStorage "rounds" and "flows" — the SAME storage the live round
    editor writes (dialogs/CreateRoundDialog/useRoundEditorForm.ts) and reads
    (hooks/useRoundFromSlug.ts) — no separate flow-content store is introduced
```

This closes the "(b-continued)" follow-up named under idea #13 ("Coaching
Programs and Group Challenges") in `TODO.md`: "wiring `CoachingProgramsPanel`
(in `debate-round`) to render a program's full `buildCoachingProgramBoard` off
this and the topic-sprint composition" (the topic-sprint/group-challenge
half), plus "a `roundId`-to-contributor mapping so a member's already-flowed
practice round can generate a drill set on this board" (the member-drill
half). `state/persistedCoachingProgramBoard.ts` composes every one of
`buildCoachingProgramBoard`'s inputs directly from its own persisted store,
mirroring `debate-card-search`'s `state/topicSprints.ts` and
`state/prepRooms.ts` "compose every input from its own store" convention, so
the panel doesn't need to assemble a topic sprint, challenge roster,
contribution feed, win-event list, or member-flow list itself — an explicit
`memberFlows` argument (including `[]`) still overrides that composition for
callers that want to.

`state/memberPracticeFlows.ts` persists only the missing link — which
`roundId` belongs to which contributor, and which side they flowed — rather
than a new copy of the flow's content. A contributor's "already-flowed
practice round" is resolved from the live round editor's own `rounds`/`flows`
`localStorage` keys, the same lookup `hooks/useRoundFromSlug.ts` already uses
(`round.flowIds.includes(flow.id)`), picking the round's flow with the most
content when it has more than one. A registered round that hasn't actually
been flowed yet (or doesn't exist) resolves to nothing and that member is
skipped from `memberDrills`, rather than rendering an empty/broken entry —
the panel calls this out as "not flowed yet" rather than staying silent.

## Known gaps

- A registered round is only ever looked up by its numeric id — there's no
  picker showing which of a member's own rounds are already flowed, so they
  need to know (or be told) their round id ahead of time.
