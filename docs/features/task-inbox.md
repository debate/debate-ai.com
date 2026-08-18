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

Routing a topic's tasks (the "Route tasks" form):
panels/TaskInboxPanel.tsx
  → routePersistedTopicTasks(topicId)  — state/routedTaskQueues.ts
      ├─ buildPersistedTopicCoverageReport(topicId) — state/trackedArguments.ts
      │    (that topic's tracked-argument checklist against the shared
      │    evidence library's entries filed under it)
      └─ buildAndPersistRoutingResult(report, topicId) — routes the report's
         gaps against the persisted contributor list, records each
         assignment's activeTaskCount, and saves the queue
  → panel re-reads buildTaskInboxView() (and the tracked-topic suggestion
    list) to refresh
```

Every routing/persistence rule already existed and was Vitest-covered; this
feature adds two new composition functions in
`packages/debate-card-search/src/state/routedTaskQueues.ts`:
`buildTaskInboxView`, which flattens the existing persisted routed-queue
store into a panel-ready shape, and `routePersistedTopicTasks`, which chains
`trackedArguments.ts`'s live coverage report straight into
`buildAndPersistRoutingResult` so the panel can route a topic from nothing
but a topic id — no new routing or completion logic was introduced.
Vitest-covered in `packages/debate-card-search/test/routedTaskQueues.test.ts`.

## Known gaps

- No contributor identity/permission checks (no auth/roles in this repo yet),
  so the inbox shows every topic's assignments rather than scoping to "my
  tasks."
- No reviewer/verification step before a task is marked complete — any
  visitor can mark any assignment done.
