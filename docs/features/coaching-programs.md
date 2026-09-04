# Coaching Programs and Group Challenges

Lets a coach create a named coaching space scoped to a squad roster, and
opens each program's live board: its shared topic sprint (research, quests,
task routing, progress, notes), its friendly group-challenge standings, and
(once a member has a flowed practice round) their generated drill set.

- **Route:** `/coaching-programs`
- **Nav:** the Tools page's Coaching & Analytics group; the Reason Editor's
  Workspace menu (`t programs` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-team-collaboration`](../../packages/debate-team-collaboration/README.md)

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
- A "Roster analytics" table — one row per roster member, with their topic-
  sprint task-completion rate, quest streak (when available), drill count,
  practice-round status, and per-challenge rank in one place — plus a
  "Download roster analytics" action (see below)

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

Roster analytics dashboard (once a board is open):
panels/CoachingProgramsPanel.tsx
  → getMemberStreak(contributorId) — optional prop, one lookup per roster member
      → apps/debate-ai.com/components/research/CoachingProgramsWithStreaks.tsx
          → buildPersistedContributorQuestStreak(contributorId, todayUtcDayKey())
                                                                  — debate-community's state/dailyMissionResults.ts
  → board.memberStreaks assembled in the panel, merged onto the already-built board
  → buildCoachingProgramRosterAnalytics(board)  — round/coaching-program.ts
      (pure aggregation over board.topicSprint.progressBoard, board.challengeBoard,
       board.memberDrills, board.memberPracticeRounds, board.memberStreaks — no new data source)
  → panel renders one table row per roster member
  → "Download roster analytics" → buildRosterAnalyticsText(board) / rosterAnalyticsFilename(programId)

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

Idea #13's "(b) a coach-facing roster analytics dashboard (completion rates,
streaks, standings in one place)" follow-up. Once a program's board is open,
a "Roster analytics" table renders below the existing status block — one row
per roster member (in the roster's own order), each showing:

- **Completion** — the member's task-completion rate and raw count, straight
  off the topic sprint's `progressBoard` (0% when the member has no tracked
  topic-sprint tasks yet)
- **Streak** — the member's current daily-quest-mission streak length, or
  `—` when unavailable
- **Drills** — how many drills their flowed practice round generated
- **Practice round** — whether a Practice Round Simulator session is
  recorded for them
- **Challenge standings** — a badge per open group challenge, showing their
  rank (`#N`) or "no activity" when they haven't matched it yet

`round/coaching-program.ts`'s `buildCoachingProgramRosterAnalytics` builds
every row by pure aggregation over the fields `buildCoachingProgramBoard`
already composes — `topicSprint.progressBoard`, `challengeBoard`'s own
ranked `memberStandings`, `memberDrills`, and `memberPracticeRounds` — so no
new data source was needed for completion rate or standings. A member's
quest streak is the one exception: that tracking lives in `debate-community`
(package dir `debate-contributor-progress`), a package that already depends
on this one, so pulling it in here directly would create a dependency
cycle. `CoachingProgramBoard` instead gained an optional, caller-supplied
`memberStreaks` map (mirroring `memberPracticeRounds`'s own convention), and
`CoachingProgramsPanel` takes an optional `getMemberStreak` prop it calls
once per roster member and merges onto the board before rendering — omit
the prop and the dashboard still renders, just without a Streak column.
`apps/debate-ai.com/components/research/CoachingProgramsWithStreaks.tsx` is
the one place that wires up both packages, resolving each member's streak
via `debate-community`'s `buildPersistedContributorQuestStreak`; both
`/coaching-programs` and the Coach Hub's Coaching tab render that wrapper
instead of the bare panel.

A "Download roster analytics" action next to the table exports the whole
dashboard as a plain-text file — `buildRosterAnalyticsText`/
`rosterAnalyticsFilename`, the same anchor+Blob download pattern every other
export in this repo uses (e.g. `PreRoundBriefingsPanel`'s "Download").

## Known gaps

- A calendar/schedule view across a program's drills, sprints, and
  challenges is not yet built (idea #13's remaining Next item in `TODO.md`).
- A digest notification summarizing group-challenge results was raised as a
  follow-up for this idea too, but turned out to already be covered by the
  News Stream feature instead of a separate notification — see
  [`news-stream.md`](./news-stream.md)'s Group Challenges source
  (`state/newsStream.ts`'s `groupChallengeNews`).
