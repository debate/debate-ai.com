# Task Inbox

Shows every research task the "Research Task Routing" system has routed to a
contributor, grouped by topic, so a contributor (or coach) can see what's
assigned, mark tasks done as they're finished, and have a different
contributor verify them before they count as complete.

- **Route:** `/cards/inbox`
- **Nav:** the Tools page's Community & Progress group; the Reason Editor's
  Workspace menu (`t inbox` in Ctrl/Cmd-Shift-Space's command palette)
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

When a real signed-in session exists, each pending verification's
"Verifier id" field is no longer just a suggestion: it's locked (read-only)
to the signed-in id, and the **Verify** button is disabled outright with an
inline explanation for a task the signed-in visitor completed themself,
instead of only failing after the click. A signed-out visitor keeps the
original fully free-form verifier field. See "Signed-in verifier gate"
under Data flow below.

A "My tasks" field lets a contributor type their own `contributorId` to
scope the list to just their own assignments, via
`filterTaskInboxViewByContributor` — still a free-form text field, not a
login. When `apps/debate-ai.com`'s real signed-in session (better-auth) has
a user, the field's *initial* value is prefilled from it — a visitor who
edits the field keeps whatever they typed instead. See "Signed-in prefill"
under Data flow below.

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

Signed-in prefill for "My tasks" (apps/debate-ai.com only):
components/research/TaskInboxWithIdentity.tsx  — "use client" wrapper
  → useSession()                          — lib/hooks/useSession.ts, the
                                              better-auth React session hook
  → deriveContributorIdFromSessionIdentity(user)
      — debate-card-search's lib/session-identity.ts: name, else the
        email's local part, else the raw account id, else ""
  → <TaskInboxPanel signedInContributorId={...} />
      — seeds myContributorId's initial value only; a visitor who edits
        the field (hasEditedMyId) keeps their own typed value from then on

Signed-in verifier gate for "Awaiting verification" (same
signedInContributorId prop, per pending record):
panels/TaskInboxPanel.tsx
  → isOwnContributorRow(record.assignment.contributorId, signedInContributorId)
      — lib/session-identity.ts: true when the signed-in id matches the
        assignee (case-insensitive, trimmed) → Verify is disabled outright,
        with an inline "a different contributor must verify it" message
  → deriveLockedVerifierId(record.assignment.contributorId, signedInContributorId)
      — lib/session-identity.ts: "" when signed out or self-assigned
        (leaves the field free-form, matching today's behavior); otherwise
        the trimmed signed-in id
  → when non-"", the Verifier id Input renders that value, disabled and
    read-only, and handleVerify's click handler passes it straight to
    verifyAndRecordResearchTask instead of reading the (now-unused)
    verifierIds[key] typed state
```

`app/cards/inbox/page.tsx` and `ResearchHub.tsx`'s Routing tab both render
`TaskInboxWithIdentity` instead of `TaskInboxPanel` directly, so the panel
itself stays app-agnostic — it only knows about a plain
`signedInContributorId` string prop, not `better-auth`.

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

The signed-in verifier gate added one pure helper, `lib/session-identity.ts`'s
`deriveLockedVerifierId` (reusing the existing `isOwnContributorRow` check),
Vitest-covered in `test/session-identity.test.ts` — no changes to
`assertVerifierAllowed`/`verifyAndRecordResearchTask` themselves, which stay
the single source of truth the panel's client-side gate is layered in front
of.

## Cross-tab live update

`TaskInboxPanel` subscribes to the browser's `storage` event (which the spec
fires only in *other* same-origin tabs/windows, never the one that made the
write), so a topic routed, task marked done, or task verified in a second
tab refreshes this tab's topics/awaiting-verification view without a manual
reload. A new pure helper,
`state/live-update.ts`'s `isTaskInboxLiveUpdateStorageEvent`, checks
whether the event's `key` is one of this panel's backing stores
(`routedTaskQueues`, `pendingTaskVerifications`, `trackedArguments`), or
`null` for a `localStorage.clear()`; when it is, the panel re-derives
`topics`/`pending`/`trackedTopics` via the same calls its mount effect
already makes. This closes, for this panel, the "Every other
localStorage-backed panel in this repo still has no cross-tab live-update
mechanism" Known gap noted in
[`shared-flow-sync.md`](shared-flow-sync.md), mirroring the existing
`DailyBestCardPanel`/`ContributionLeaderboardPanel` precedent (see
[`contribution-leaderboard.md`](contribution-leaderboard.md)'s "Cross-tab
live update"). Vitest-covered in
`packages/debate-card-search/test/live-update.test.ts` (every backing-store
key, the `null`-key clear-all case, and unrelated/substring-matching keys
staying ignored).

## Known gaps

- The "My tasks" filter is still free-form text, not a login — a real
  signed-in session only *prefills* it (see "Signed-in prefill" above), so
  a visitor can still overwrite it to browse anyone's assignments. The
  verifier-id half of this gap is closed: see "Signed-in verifier gate"
  above — when signed in, the Verifier id field is locked to that identity
  and self-verification is disabled outright, not just a typed suggestion.
  A signed-out visitor still has a fully free-form verifier field, since
  this repo doesn't require login to use.
- No follow-ups remain open on the "No reviewer/verification step before a
  task is marked complete" gap — see "Awaiting verification" above.
- The signed-in verifier gate is enforced client-side only (the panel
  disables the input/button); `verifyAndRecordResearchTask`/
  `assertVerifierAllowed` still accept whatever `verifierId` string a
  caller passes, so a caller bypassing this panel (or a signed-out
  visitor) is unaffected — the same trust boundary every other
  localStorage-backed action in this repo has, since there is no
  server-side session check on these calls.
