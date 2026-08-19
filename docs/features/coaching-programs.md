# Coaching Programs and Group Challenges

Lets a coach create a named coaching space scoped to a squad roster, and
opens each program's live board: its shared topic sprint (research, quests,
task routing, progress, notes), its friendly group-challenge standings, and
(once a member is assigned a flowed round) their generated drill set.

- **Route:** `/coaching-programs`
- **Nav:** the global dock's Settings menu → **Coaching Programs**
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

A form to create a coaching space (name + comma-separated squad-roster member
IDs), then every persisted `CoachingProgramConfig` with a roster badge list
and a "Remove" action. Each program also has a "View board" action that opens:

- A **member round assignments** section — one row per roster member with a
  round id + side input, a "Save" action, and (once assigned) a "Clear"
  action, so a coach can point a member at the live flow editor round
  (`Flow.id`) they want their drills generated from.
- A topic input; once a topic is entered, the program's live board renders as
  a status block:
  - The coaching space's name and member count
  - The topic sprint's status line (quest progress, task routing, active
    contributors, open follow-up notes)
  - Each open group challenge's live standings line
  - How many members currently have a generated drill set
  - Each member's own resolved drill set (or a "no practice round flowed yet"
    placeholder), one line per member

## Data flow

```
state/coachingPrograms.ts (localStorage: coachingPrograms)
  → buildCoachingProgramsPanelView()   — every persisted CoachingProgramConfig,
                                          name-sorted
  → panels/CoachingProgramsPanel.tsx   — renders the config form + list

state/memberRoundAssignments.ts (localStorage: memberRoundAssignments)
  → saveMemberRoundAssignment/deleteMemberRoundAssignment  — one {roundId, sideKey}
                                                              per (programId, contributorId)
  → panels/CoachingProgramsPanel.tsx's "Member round assignments" form

apps/debate-ai.com/app/coaching-programs/page.tsx  — mounts the panel as a route

Opening a program's board (topic entered in the panel):
panels/CoachingProgramsPanel.tsx
  → buildPersistedCoachingProgramBoard(programId, topic, now)  — state/persistedCoachingProgramBoard.ts
      → getCoachingProgram(programId)                          — state/coachingPrograms.ts
      → readPersistedTopicSprintInputs(topic)                  — debate-card-search's state/topicSprints.ts
      → listGroupChallenges()                                  — debate-card-search's state/groupChallenges.ts
      → listContributions() (filtered to a submittedAt timestamp) — debate-card-search's state/contributions.ts
      → listChallengeWinEvents()                                — debate-card-search's state/challengeWinEvents.ts
      → buildMemberFlowsFromAssignments(programId)               — state/persistedCoachingProgramBoard.ts
          → listMemberRoundAssignments(programId)                — state/memberRoundAssignments.ts
          → getLiveFlowByRoundId(roundId)                        — state/liveFlows.ts (reads the live
                                                                    flow editor's own "flows" localStorage array)
      → buildCoachingProgramBoard({ program, topicSprint, challenges, contributions, winEvents, memberFlows })
                                                                  — round/coaching-program.ts
  → buildCoachingProgramSummaryText(board) / buildMemberDrillSummaryText(board, memberId)
                                                                  — round/coaching-program.ts
  → panel renders it as a status block
```

This closes the "(b-continued)" follow-up named under idea #13 ("Coaching
Programs and Group Challenges") in `TODO.md` in full: the topic-sprint/
group-challenge half ("wiring `CoachingProgramsPanel` to render a program's
full `buildCoachingProgramBoard`") plus the remaining member-drill half ("a
`roundId`-to-contributor mapping so a member's already-flowed practice round
can generate a drill set on this board"). `state/persistedCoachingProgramBoard.ts`
composes every one of `buildCoachingProgramBoard`'s inputs directly from its
own persisted store, mirroring `debate-card-search`'s `state/topicSprints.ts`
and `state/prepRooms.ts` "compose every input from its own store, but let a
caller override" convention — a caller can still pass an explicit
`memberFlows` list to `buildPersistedCoachingProgramBoard` to bypass the
stored assignments.

`roundId` here is the same convention `hooks/useWordCountSpeechMode.ts`
already uses: the live flow editor's own `Flow.id`, stringified — not one of
this package's separate "practice round" session ids
(`aiVersusRounds.ts`/`practiceRounds.ts`). An assignment whose `roundId`
doesn't resolve to a stored live flow (never flowed, or since deleted) is
skipped rather than producing a broken drill set — that member's board just
renders with no drills yet.

## Known gaps

- Follow-up (c) on idea #13 — wiring a member's practice-round setup/feedback
  (Practice Round Simulator) into the coaching space — remains open, not
  started.
- The round-assignment form is an id + side text input, not a picker over a
  member's actual flow list; a coach needs to already know the round's
  numeric id from the flow editor.
