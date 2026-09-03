# Research Progress Tracking

Shows each contributor's progress across topics, task completion, and
contribution history: how many contributions they've made, how many routed
research tasks they've completed vs. still have active, and a per-topic
completion breakdown.

- **Route:** `/cards/progress-tracking`
- **Nav:** the Tools page's Community & Progress group; the Reason Editor's
  Workspace menu (`t research progress` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

One row per contributor with either a scored contribution or a routed task
assignment (active or completed), sorted alphabetically by contributor id:

| Column | Source |
| --- | --- |
| Contributor | `contributorId` |
| Contributions | Contribution count + total helpfulness score, from `lib/contribution-leaderboard.ts` |
| Tasks | Completed/assigned task count and completion rate, from `lib/research-progress.ts` |
| Topics | Per-topic completed/assigned counts |

A signed-in visitor's own row is highlighted with a "You" badge — see
"Signed-in row highlight" below. The roster always shows every contributor;
nothing is filtered. Below the roster, a "Topic comparison" section shows
the same data rolled up per topic across the whole team instead of per
contributor — see "Topic comparison" below.

## Data flow

```
Marking a task complete (Task Inbox panel):
panels/TaskInboxPanel.tsx
  → completeAndRecordResearchTask(topicId, argBlock, completedAt)  — state/researchProgress.ts
      ├─ completePersistedRoutedTask(topicId, argBlock)  — state/routedTaskQueues.ts
      │     (removes the assignment from the active queue, decrements the
      │      assignee's stored activeTaskCount)
      └─ appends a CompletedTaskRecord {topic, assignment, completedAt}
         to its own localStorage store (completedResearchTasks)

Rendering the roster:
state/contributions.ts (localStorage: contributions)
state/researchProgress.ts (localStorage: completedResearchTasks)
state/routedTaskQueues.ts (localStorage: routedTaskQueues, still-active assignments)
  → buildPersistedResearchProgressBoard()   — state/researchProgress.ts
      composes all three into TrackedTopicAssignment[] + AttributedContribution[]
      and hands them to lib/research-progress.ts's buildResearchProgressBoard
  → panels/ResearchProgressPanel.tsx        (renders the roster table)
  → apps/debate-ai.com/app/cards/progress-tracking/page.tsx  (mounts the panel)

Signed-in row highlight (apps/debate-ai.com only):
components/research/ResearchProgressWithIdentity.tsx  — "use client" wrapper
  → useSession()                          — lib/hooks/useSession.ts, the
                                              better-auth React session hook
  → deriveContributorIdFromSessionIdentity(user)
      — debate-card-search's lib/session-identity.ts: name, else the
        email's local part, else the raw account id, else ""
  → <ResearchProgressPanel signedInContributorId={...} />
      → isOwnContributorRow(progress.contributorId, signedInContributorId)
          — case-insensitive, trims both sides — adds a "You" badge and a
            highlight to that one row; the roster is never filtered
```

`app/cards/progress-tracking/page.tsx` and `ResearchHub.tsx`'s Progress tab
both render `ResearchProgressWithIdentity` instead of `ResearchProgressPanel`
directly, so the panel itself stays app-agnostic — it only knows about a
plain `signedInContributorId` string prop, not `better-auth`. Unlike Task
Inbox's "My tasks" field, this roster has no free-form id field to prefill —
it always renders every contributor — so the signed-in identity only
highlights a matching row instead. Adds one new pure helper,
`isOwnContributorRow` (`lib/session-identity.ts`, Vitest-covered in
`test/session-identity.test.ts`).

`lib/research-progress.ts`'s pure aggregation (`buildContributorProgress`,
`buildTopicProgress`, `buildResearchProgressBoard`) already existed and was
Vitest-covered; this feature adds the persistence half it was missing:
`completeAndRecordResearchTask` (closing follow-up (a), "wiring real
task-completion events into a persisted assignment/completion history" —
previously a completed task was only ever removed from its queue, never
remembered) and `buildPersistedResearchProgressBoard` plus
`ResearchProgressPanel` (closing follow-up (b), "a progress dashboard/roster
UI"). Vitest-covered in
`packages/debate-card-search/test/researchProgress.test.ts` (completion
history persistence, corrupt-storage recovery, and board composition across
contributors with only contributions, only active tasks, or both).

Follow-up (c), feeding a contributor's topic-progress history back into
`progress-unlocks.ts`'s tier computation, is now closed too:
`lib/progress-unlocks.ts`'s `UnlockTierRequirement` gained a
`minCompletedTaskCount` threshold, and `computeContributorTier` now reaches
a tier via the existing contribution-count-and-score path **or** by
clearing `minCompletedTaskCount` alone — completing enough routed research
tasks (`research-task-routing.ts`) is real research contribution in its own
right, so a contributor can unlock a tier that way even without matching
scored-contribution volume. `lib/unlock-streak-status.ts`'s
`buildContributorUnlockStatusWithStreakFromStore`/`buildUnlockStatusRoster`
now source their `ContributorStats` from this module's own
`buildPersistedLeaderboardWithCompletedTasks` (real, persisted
`completedResearchTasks` history) instead of `state/contributions.ts`
alone, so the Progress Unlocks panel (`/cards/progress`) reflects real task
completion and now also lists a contributor who has completed tasks but no
scored contribution yet. See
[Progress Unlocks](./progress-unlocks.md). Vitest-covered in
`packages/debate-card-search/test/progress-unlocks.test.ts` (tier reached
via completed tasks alone, the highest tier across both paths, and
backward compatibility for contributors with no completed-task data) and
`packages/debate-card-search/test/unlock-streak-status.test.ts` (real
completed-task history feeding a store-backed status, and a task-only
contributor appearing in the roster).

A topic's completed-task history can now be pruned:
`state/researchProgress.ts`'s `deleteCompletedTaskHistoryForTopic(topic)`
removes every `CompletedTaskRecord` for that topic (mirroring
`routedTaskQueues.ts`'s existing `deleteRoutedTaskQueue(topicId)` pattern,
and leaving the topic's still-active queue and every other topic's history
untouched), and `ResearchProgressPanel` renders a "Clear completed history"
action next to each topic badge that has at least one completed task. This
closes the "a completed task's history record is never deleted" Known gap
previously recorded below. Vitest-covered in
`packages/debate-card-search/test/researchProgress.test.ts`
(`deleteCompletedTaskHistoryForTopic`: removing a topic's records, leaving
other topics' history untouched, a no-op on an untracked topic, and not
touching the active-queue store).

## Cross-tab live update

`ResearchProgressPanel` subscribes to the browser's `storage` event (fires
only in *other* same-origin tabs/windows, never the one that made the
write) via `state/live-update.ts`'s `isResearchProgressLiveUpdateStorageEvent`
and re-derives the roster when it fires for one of its backing keys
(`contributions`, `completedResearchTasks`, `routedTaskQueues`), so a
contribution submitted, task completed, or topic routed in a second tab now
refreshes this tab's roster without a manual reload — closing the "Every
other localStorage-backed panel in this repo still has no cross-tab
live-update mechanism" Known gap noted in
[`shared-flow-sync.md`](./shared-flow-sync.md), for this panel.
Vitest-covered in `packages/debate-card-search/test/live-update.test.ts`.

## Report download

The panel header has a "Download report" button that exports the whole
roster as a single plain-text file — the "printable/exportable progress
report" follow-up named under the "📈 Research Progress Tracking" bullet in
TODO.md. `lib/research-progress.ts`'s `buildResearchProgressReportText`
renders one section per contributor: `buildProgressSummaryText`'s existing
summary line, followed by an indented per-topic completion breakdown
(`- <topic>: <completed>/<assigned> (<rate>%)`), or a "No topic assignments"
line for a contributor with contributions but no routed tasks. The button
mirrors `PreRoundBriefingsPanel.tsx`'s anchor+Blob download pattern, saving
to the fixed filename `research-progress-report.txt` from
`researchProgressReportFilename()` — the report covers the whole roster
rather than a single round or topic, so there's no natural id to key the
filename on. Vitest-covered in
`packages/debate-card-search/test/research-progress.test.ts`
(`buildResearchProgressReportText`: the empty-roster placeholder, a full
per-contributor/per-topic render, the "no topic assignments" fallback, and
multi-contributor section separation).

## Topic comparison

Below the roster, a "Topic comparison" section rolls each contributor's own
per-topic counts up into one row per topic across the whole team — the
"topic-comparison view across the whole team" follow-up named under the "📈
Research Progress Tracking" bullet in TODO.md. `lib/research-progress.ts`'s
`buildTeamTopicComparison(roster)` groups every `ContributorProgress.topics`
entry by topic name, summing assigned/completed task counts and counting the
distinct contributors with at least one assignment in that topic, then sorts
by completion rate ascending (the least-covered topic first, tie-broken
alphabetically) so a coach or team lead can see which topics the team as a
whole is behind on at a glance rather than reading one contributor's row at a
time. Each row shows the topic, contributor count, completed/assigned task
count, and a `MeterBar` completion meter (the same meter component
`ProgressUnlocksPanel` uses for its "Next tier" column). The section is
hidden entirely when no contributor has any topic assignment. Vitest-covered
in `packages/debate-card-search/test/research-progress.test.ts`
(`buildTeamTopicComparison`: rolling counts up across contributors, sorting
least-covered-first, the alphabetical tie-break, an empty roster, and that a
topic's contributor count only includes contributors with an assignment in
that specific topic).

## Personal goal-setting

A signed-in visitor gets a "My research goal" section above the roster (only
rendered when `signedInContributorId` is set) — the "personal goal-setting
UI" follow-up named under the "📈 Research Progress Tracking" bullet in
TODO.md. They can set a personal target number of completed tasks, either
overall or scoped to one topic, and track progress toward it with a
`MeterBar` meter — the same meter component the "Topic comparison" section
above uses. `lib/research-progress.ts`'s `ResearchProgressGoal`/
`computeGoalProgress` are pure: `computeGoalProgress` resolves a goal's
current count from an already-built `ContributorProgress` — either
`totalCompletedTasks` (no topic set) or that one topic's
`TopicProgress.completedTaskCount` (0 if the contributor has no assignments
in it at all) — and clamps `progressRatio` to `[0, 1]`.
`state/researchProgressGoals.ts` persists at most one goal per contributor in
localStorage (array of records filtered by `contributorId`, mirroring
`streakFreezes.ts`'s persistence convention), and
`getPersistedGoalProgressForContributor` composes `computeGoalProgress`
directly against the real, persisted `buildPersistedResearchProgressBoard` so
the panel doesn't need to look up the contributor's own row itself. A goal
reached shows a "🎉 Goal reached" badge in place of the meter's remaining-task
caption. This is deliberately local-only, not account-synced — like
`streakLapseReminders.ts`, a lightweight per-visitor preference rather than a
record other contributors need to see (see "Known gaps" below). Vitest-covered
in `packages/debate-card-search/test/research-progress.test.ts`
(`computeGoalProgress`: an overall goal, a topic-scoped goal, a topic the
contributor has no assignments in, and clamping once the count exceeds the
target) and `packages/debate-card-search/test/researchProgressGoals.test.ts`
(goal CRUD — set/replace/clear, per-contributor isolation, the
`InvalidGoalTargetError` guard on a non-positive target, corrupt-storage
recovery — and `getPersistedGoalProgressForContributor` composed against the
real persisted board, including a contributor with a goal but no board row
yet, and a goal that becomes complete once a task is recorded without
re-setting it).

## Known gaps

- No contributor identity/permission *checks* — a real signed-in session now
  *highlights* the visitor's own row (see "Signed-in row highlight" above),
  but the roster still shows every contributor, the same "prefill/highlight
  only, not a gate" known gap the Leaderboard, Task Inbox, and Progress
  Unlocks panels carry.
- The personal goal is local-only (per browser), not account-synced, and
  only reachable once the roster is non-empty (a signed-in visitor with
  literally no tracked contribution or task yet sees the panel's "No
  progress yet" empty state instead of the goal section) — both stay open
  follow-ups if this turns out to matter.
