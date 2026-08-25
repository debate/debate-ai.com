# Task Inbox

Shows every research task the "Research Task Routing" system has routed to a
contributor, grouped by topic, so a contributor (or coach) can see what's
assigned, mark tasks done as they're finished, and have a different
contributor verify them before they count as complete.

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
| Mark done | Calls `markRoutedTaskAwaitingVerification(topicId, argBlock, markedDoneAt)` |

Tasks nobody was eligible or available for (`unassignedTasks`) are listed
separately per topic, with no complete action.

A task marked done doesn't credit the completion right away — it moves into
an "Awaiting verification" section, listing every persisted
`PendingTaskVerification`. A different contributor types their own id and
clicks **Verify** to confirm it (calling `verifyAndRecordResearchTask`),
closing the "No reviewer/verification step before a task is marked
complete" Known gap below. The assignee themself can't verify their own
task — attempting to leaves an inline error and the task still pending.

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

Marking a task done (not yet credited):
panels/TaskInboxPanel.tsx
  → markRoutedTaskAwaitingVerification(topicId, argBlock, markedDoneAt)
      — state/pendingTaskVerifications.ts
      ├─ completePersistedRoutedTask(topicId, argBlock)  — state/routedTaskQueues.ts
      │    ├─ removes the assignment from the stored queue
      │    └─ recordPersistedTaskCompleted(contributorId) — decrements the
      │       assignee's stored activeTaskCount (state/contributorAvailability.ts)
      └─ stores a PendingTaskVerification record
         (localStorage: pendingTaskVerifications)
  → panel re-reads buildTaskInboxView() and listPendingTaskVerifications()
    to refresh

Verifying a task (credits the completion):
panels/TaskInboxPanel.tsx
  → verifyAndRecordResearchTask(topicId, argBlock, verifierId, verifiedAt)
      — state/researchProgress.ts
      ├─ assertVerifierAllowed(assignment, verifierId) — lib/task-verification.ts
      │    throws VerifierIdRequiredError/SelfVerificationNotAllowedError if
      │    verifierId is blank or matches the assignee's own contributorId
      ├─ appends a CompletedTaskRecord (localStorage: completedResearchTasks)
      └─ removePendingTaskVerification(topicId, argBlock)
  → panel re-reads listPendingTaskVerifications() to refresh; a thrown guard
    error is shown inline instead, leaving the task still pending

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

The verification step added `lib/task-verification.ts`'s
`assertVerifierAllowed` (mirroring `lib/peer-review.ts`'s identical
self-review guard on approve/reject/publish), `state/pendingTaskVerifications.ts`
(the new "awaiting verification" store plus `markRoutedTaskAwaitingVerification`,
which composes `completePersistedRoutedTask` the same way the old direct
"mark complete" action did), and `state/researchProgress.ts`'s
`verifyAndRecordResearchTask` (which only credits a `CompletedTaskRecord`
once the guard passes). `state/researchProgress.ts`'s existing
`completeAndRecordResearchTask` is unchanged — it still credits a completion
immediately with no verification required, so every other existing caller
(and its tests) keeps working exactly as before; only this panel's "Mark
done"/"Verify" UI uses the new gated path.
Vitest-covered in `packages/debate-card-search/test/task-verification.test.ts`
and `packages/debate-card-search/test/pendingTaskVerifications.test.ts`, plus
new cases in `test/researchProgress.test.ts` for `verifyAndRecordResearchTask`.

## Known gaps

- No contributor identity/permission checks (no auth/roles in this repo
  yet), so the "My tasks" filter is a free-form id field, not a login —
  anyone can type any contributor's id to see their assignments. The same
  applies to the verification step: a verifier is just whoever types a
  different free-form id, not an authenticated reviewer.
- No follow-ups remain open on the "No reviewer/verification step before a
  task is marked complete" gap — see "Awaiting verification" above.
