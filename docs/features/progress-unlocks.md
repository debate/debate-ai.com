# Progress Unlocks

Shows every contributor's unlock tier, the research-task skill level that
tier grants, every badge earned (tier + daily-quest streak badges), their
current streak, and how far they are from the next tier.

- **Route:** `/cards/progress`
- **Nav:** the global dock's Settings menu → **Progress**
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

One row per contributor with at least one persisted contribution, sorted
alphabetically by contributor id (this view isn't ranked by score — see the
[Contribution Leaderboard](./contribution-leaderboard.md) for that):

| Column | Source |
| --- | --- |
| Contributor | `contributorId` |
| Tier | `novice` / `apprentice` / `veteran` / `expert`, from `lib/progress-unlocks.ts` |
| Unlocked tasks | The `research-task-routing.ts` `SkillLevel` that tier grants |
| Streak | Current consecutive-day quest streak, from `lib/gamified-quests.ts` |
| Tasks completed | Completed `research-task-routing.ts` tasks, from `state/researchProgress.ts`'s persisted completion history |
| Badges | Tier badges + streak-milestone badges, merged by `lib/unlock-streak-status.ts` |
| Next tier | Contributions and helpfulness points, **or** completed tasks, still needed to reach the next tier |

## Data flow

```
state/contributions.ts (localStorage)
state/researchProgress.ts (localStorage: completedResearchTasks)
  → buildUnlockStatusRoster()             — lib/unlock-streak-status.ts
      ├─ lists every contributor id with a persisted contribution or
      │  completed task (state/researchProgress.ts's
      │  buildPersistedLeaderboardWithCompletedTasks)
      └─ buildContributorUnlockStatusWithStreakFromStore() per contributor
          ├─ lib/progress-unlocks.ts   (tier, unlocked skill level, tier badges, next-tier progress)
          └─ lib/gamified-quests.ts    (streak, streak badges, via state/dailyMissionResults.ts)
  → panels/ProgressUnlocksPanel.tsx        (renders the roster table)
  → apps/debate-ai.com/app/cards/progress/page.tsx  (mounts the panel as a route)
```

Every tier/badge/streak rule already existed and was Vitest-covered; this
feature adds one new composition function, `buildUnlockStatusRoster`
(`packages/debate-card-search/src/lib/unlock-streak-status.ts`), which lists
every contributor with a persisted contribution and resolves each one's
status through the already-existing `buildContributorUnlockStatusWithStreakFromStore`
— no new tier, badge, or streak logic was introduced. Vitest-covered in
`packages/debate-card-search/test/unlock-streak-status.test.ts` (empty roster
when nothing is persisted, multiple contributors sorted alphabetically with
their own tier/streak, and per-contributor data isolation).

A later slice closed this page's own "Known gaps" follow-up — see
[Research Progress Tracking](./research-progress-tracking.md) for the
completed-task-as-tier-signal change.

## Known gaps

- No contributor identity/auth scoping yet — the roster shows every
  contributor, the same known gap as the Leaderboard and Task Inbox panels.
- No topic/task-level progress breakdown here — that's the separate
  "Research Progress Tracking" idea in `TODO.md`.
