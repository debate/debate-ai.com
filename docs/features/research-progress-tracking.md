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

## Known gaps

- Follow-up (c) — feeding a contributor's topic-progress history back into
  `progress-unlocks.ts`'s tier computation — remains open, not started.
- No contributor identity/auth scoping yet — the roster shows every
  contributor, the same known gap as the Leaderboard, Task Inbox, and
  Progress Unlocks panels.
- A completed task's history record is never deleted (e.g. if its topic's
  queue is deleted), so `completedResearchTasks` only grows.
