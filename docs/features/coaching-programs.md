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
      → readPersistedTopicSprintInputs(topic)                  — debate-team-collaboration's state/topicSprints.ts
      → listGroupChallenges()                                  — debate-team-collaboration's state/groupChallenges.ts
      → listContributions() (filtered to a submittedAt timestamp) — debate-research-evidence's state/contributions.ts
      → listChallengeWinEvents()                                — debate-team-collaboration's state/challengeWinEvents.ts
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
own persisted store, mirroring `debate-team-collaboration`'s `state/topicSprints.ts`
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

## Roster challenge digest

Closes idea #13's own further follow-up in `TODO.md`: "A digest notification
summarizing challenge results instead of requiring a panel visit." Before
this, seeing a squad's own completed group challenges meant either visiting
`debate-team-collaboration`'s Group Challenges panel directly or spotting the
one-line announcement `state/newsStream.ts`'s `groupChallengeNews()` already
auto-posts to the Community feed for *every* completed challenge across
every roster — not scoped to any one coaching program. The Roster Analytics
section now also renders a **Recent challenge results** list below the
roster table: every completed group challenge whose own roster overlaps the
selected program's roster, newest first, each line naming the challenge and
its MVP (`buildChallengeCompletionAnnouncementText`, reused directly from
`group-challenges.ts` rather than a second summary-text formatter), capped to
the 10 most recent with a "showing N of M" note once there are more.

```
panels/CoachingProgramRosterAnalyticsPanel.tsx  (debate-community package)
  → buildPersistedCoachingProgramChallengeDigest(programId)  — state/coachingProgramRosterAnalytics.ts
      → getCoachingProgram(programId)                        — debate-team-collaboration's state/coachingPrograms.ts
      → buildCompletedGroupChallengeEvents()                  — debate-team-collaboration's state/challengeWinEvents.ts
                                                                  (feed-wide; each event now also carries the challenge's own memberIds)
      → buildCoachingProgramChallengeDigest(memberIds, completedEvents)
                                                                — lib/coaching-program-roster-analytics.ts
                                                                  (keeps only events whose memberIds overlap the roster)
  → buildChallengeCompletionAnnouncementText(entry)            — debate-team-collaboration's lib/group-challenges.ts
```

`CompletedGroupChallengeEvent` (`debate-team-collaboration`'s
`state/challengeWinEvents.ts`) gained a `memberIds` field — the completed
challenge's own roster — since the feed-wide event record otherwise had no
way to tell a coaching-program-scoped digest which roster it belonged to;
`state/newsStream.ts`'s `groupChallengeNews()` is unaffected by the added
field. The digest composition lives alongside the existing roster analytics
in `debate-community` for the same circular-dependency reason described
above, and refreshes on the same `storage`-event subscription (the digest's
own two source keys, `groupChallenges`/`challengeWinEvents`, were already in
`COACHING_PROGRAM_ROSTER_ANALYTICS_LIVE_UPDATE_STORAGE_KEYS`, so no changes
were needed there).

## Program calendar

Closes idea #13's own further follow-up in `TODO.md`: "A calendar/schedule
view across a program's drills, sprints, and challenges." Before this, seeing
a program's actual dated events meant piecing together the Group Challenges
panel's own start/end dates and a topic sprint's note thread separately — the
Roster Analytics section's own digest above only ever showed *completed*
challenges, not the still-open windows a coach might want to plan around. The
Roster Analytics section now also renders a **Program calendar** section
below the challenge digest: a day-grouped, chronological list of every
roster-scoped group challenge's start and end date, the signed-in coach's own
scheduled drill review reminders, plus — once a topic is typed into the
section's own topic field — that topic's sprint notes, dated by when they
were logged.

```
app/coaching-programs/CoachingProgramRosterAnalyticsWithDrills.tsx  (apps/debate-ai.com, "use client")
  → useDrillSets()                                            — debate-practice-rounds' hooks/useDrillSets.ts
  → buildDrillReviewCalendarEvents(drillSets)                 — debate-practice-rounds' state/drillSets.ts
                                                                 (one { dayKey, label, detail } per scheduled
                                                                 drill review — dependency-free of debate-community)
  → <CoachingProgramRosterAnalyticsPanel drillReviewEvents={...} />

panels/CoachingProgramRosterAnalyticsPanel.tsx  (debate-community package)
  → buildPersistedCoachingProgramCalendar(programId, topic, drillReviewEvents)  — state/coachingProgramCalendar.ts
      → getCoachingProgram(programId)                        — debate-team-collaboration's state/coachingPrograms.ts
      → listGroupChallenges()                                — debate-team-collaboration's state/groupChallenges.ts
      → listSprintNotesForTopic(topic)                        — debate-team-collaboration's state/sprintNotes.ts (only when topic is non-blank)
      → buildCoachingProgramCalendarEvents(memberIds, challenges, sprintNotes, drillReviews)
                                                                — lib/coaching-program-calendar.ts
                                                                  (challenges narrowed to ones whose own
                                                                  memberIds overlaps the roster, same rule
                                                                  buildCoachingProgramChallengeDigest uses;
                                                                  drillReviews merged in as-is, unfiltered by
                                                                  roster — a drill set has no roster concept)
  → groupCoachingProgramCalendarEventsByDay(events)           — lib/coaching-program-calendar.ts
  → panel renders one heading per day, a badge per event kind
```

A topic sprint isn't itself dated the way a challenge window is (`startsAt`/
`endsAt`), so the calendar's sprint-note events come from a topic the coach
types into the section — leaving it blank still shows the program's
challenge-window and drill-review events, just with no note events. The
composition lives alongside the existing roster analytics/digest in
`debate-community` for the same circular-dependency reason described above,
and refreshes on the same `storage`-event subscription — `sprintNotes` was
added to `COACHING_PROGRAM_ROSTER_ANALYTICS_LIVE_UPDATE_STORAGE_KEYS` so a
note logged in another tab (or from `debate-team-collaboration`'s own
`TopicSprintPanel`) refreshes the calendar here too.

Per-drill scheduled review reminders (`debate-practice-rounds`'
`state/drillSets.ts#scheduledReviewAt`) — the "drills" part the original
follow-up named alongside sprints and challenges — are folded in via the
panel's optional `drillReviewEvents` prop rather than read inside
`debate-community` directly: `debate-practice-rounds` already depends on
`debate-community` (for Progress Unlocks tiers), so importing it back here
would be circular. Instead `CoachingProgramRosterAnalyticsWithDrills.tsx` (the
app/page layer, which already depends on both packages) resolves the
signed-in coach's own drill sets via `useDrillSets()` and
`buildDrillReviewCalendarEvents`, into a dependency-free
`{ dayKey, label, detail }` shape `debate-community`'s calendar types accept
without knowing anything about `Drill`/`DrillSetRecord`. A drill set has no
roster/membership concept the way a `GroupChallenge` does, so these events
are the *viewing coach's own* scheduled reviews, not roster-wide — every
other calendar entry (challenges, sprint notes) is roster/topic-scoped, so a
coach viewing a program they're not personally drilling for sees no
drill-review events, which is expected.

## Known gaps

- The roster analytics table only covers group-challenge standings and
  daily-quest streaks — it doesn't yet fold in drill-completion rate or
  practice-round counts, both already shown per-member on the program's own
  board section above. A future run could widen the table to include them.
- The program calendar's drill-review events are scoped to the viewing
  coach's own drill sets, not the roster's — there's no per-member drill data
  a coach can see for teammates today. Widening this to a real roster-wide
  view would need drill sets to carry an owning contributor id and a way to
  look them up across the roster, neither of which exists yet.
