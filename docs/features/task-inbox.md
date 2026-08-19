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

A "My tasks" field lets a contributor type their own `contributorId` to
scope the list to just their own assignments, via
`filterTaskInboxViewByContributor` — a free-form filter, not a login, since
this repo has no auth/identity system (the same workaround
`flow/prep-note-notifications.ts` uses for "🔄 Strategy Sync Notes").

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
feature adds three composition functions in
`packages/debate-card-search/src/state/routedTaskQueues.ts`:
`buildTaskInboxView`, which flattens the existing persisted routed-queue
store into a panel-ready shape; `routePersistedTopicTasks`, which chains
`trackedArguments.ts`'s live coverage report straight into
`buildAndPersistRoutingResult` so the panel can route a topic from nothing
but a topic id; and `filterTaskInboxViewByContributor`, which scopes that
panel-ready shape down to one contributor's own assignments (dropping a
topic entirely once none of its assignments match, and clearing
`unassignedTasks` since an unassigned task isn't anyone's yet) — no new
routing or completion logic was introduced.
Vitest-covered in `packages/debate-card-search/test/routedTaskQueues.test.ts`.

## Known gaps

- No contributor identity/permission checks (no auth/roles in this repo
  yet), so the "My tasks" filter is a free-form id field, not a login —
  anyone can type any contributor's id to see their assignments.
- No reviewer/verification step before a task is marked complete — any
  visitor can mark any assignment done.
