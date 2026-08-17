# Task Inbox

Shows every research task the "Research Task Routing" system has routed to a
contributor, grouped by topic, so a contributor (or coach) can see what's
assigned and mark tasks complete as they're finished.

- **Route:** `/cards/inbox`
- **Nav:** the global dock's Settings menu → **Task Inbox**
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

Per topic (a persisted `RoutedTaskQueueRecord`, keyed by `topicId`):

| Field | Source |
| --- | --- |
| Task | `assignment.task.argBlock` — the under-covered argument the task is for |
| Level | `missing` or `thin`, from `lib/topic-coverage.ts`'s coverage classification |
| Assignee | `assignment.contributorId` |
| Assignee skill | The contributor's current persisted `skillLevel`, if their profile still exists |
| Mark complete | Calls `completePersistedRoutedTask(topicId, argBlock)` |

Tasks nobody was eligible or available for (`unassignedTasks`) are listed
separately per topic, with no complete action.

## Data flow

```
state/routedTaskQueues.ts (localStorage: routedTaskQueues)
  → buildTaskInboxView()                — flattens every persisted queue,
                                           tagging each assignment with its
                                           topicId and the assignee's current
                                           skill level from
                                           state/contributorAvailability.ts
  → panels/TaskInboxPanel.tsx            — renders it, grouped by topic

Marking a task complete:
panels/TaskInboxPanel.tsx
  → completePersistedRoutedTask(topicId, argBlock)  — state/routedTaskQueues.ts
      ├─ removes the assignment from the stored queue
      └─ recordPersistedTaskCompleted(contributorId) — decrements the
         assignee's stored activeTaskCount (state/contributorAvailability.ts)
  → panel re-reads buildTaskInboxView() to refresh
```

Every routing/persistence rule already existed and was Vitest-covered; this
feature adds one new composition function, `buildTaskInboxView`
(`packages/debate-card-search/src/state/routedTaskQueues.ts`), which flattens
the existing persisted routed-queue store into a panel-ready shape — no new
routing or completion logic was introduced. Vitest-covered in
`packages/debate-card-search/test/routedTaskQueues.test.ts`.

## Known gaps

- No task-routing trigger UI yet — a topic's queue is only populated by
  calling `buildAndPersistRoutingResult` some other way (e.g. a future
  coverage-dashboard "route tasks" action).
- No contributor identity/permission checks (no auth/roles in this repo yet),
  so the inbox shows every topic's assignments rather than scoping to "my
  tasks."
- No reviewer/verification step before a task is marked complete — any
  visitor can mark any assignment done.
