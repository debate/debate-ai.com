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

A signed-in visitor's own row is highlighted with a "You" badge — see
"Signed-in row highlight" below. The roster always shows every contributor;
nothing is filtered.

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

## Known gaps

- No contributor identity/permission *checks* — a real signed-in session now
  *highlights* the visitor's own row (see "Signed-in row highlight" above),
  but the roster still shows every contributor, the same "prefill/highlight
  only, not a gate" known gap the Leaderboard, Task Inbox, and Progress
  Unlocks panels carry.
