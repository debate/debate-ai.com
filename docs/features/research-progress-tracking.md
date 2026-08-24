# Research Progress Tracking

Shows each contributor's progress across topics, task completion, and
contribution history: how many contributions they've made, how many routed
research tasks they've completed vs. still have active, and a per-topic
completion breakdown.

- **Route:** `/cards/progress-tracking`
- **Nav:** the global dock's Settings menu → **Research Progress**
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
```

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

## Known gaps

- No contributor identity/auth scoping yet — the roster shows every
  contributor, the same known gap as the Leaderboard, Task Inbox, and
  Progress Unlocks panels.
