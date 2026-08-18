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
| Tier | `novice` / `apprentice` / `veteran` / `expert`, from `lib/unlock-progress-status.ts` (gates `lib/progress-unlocks.ts`'s thresholds with a completed-task count) |
| Unlocked tasks | The `research-task-routing.ts` `SkillLevel` that tier grants |
| Streak | Current consecutive-day quest streak, from `lib/gamified-quests.ts` |
| Tasks done | Completed *assigned* research-task count, from `lib/research-progress.ts` via `state/researchProgress.ts` |
| Badges | Tier badges + streak-milestone badges, merged by `lib/unlock-streak-status.ts` |
| Next tier | Contributions, helpfulness points, and completed tasks still needed to reach the next tier |

## Data flow

```
state/contributions.ts (localStorage)
  → buildUnlockStatusRoster()             — lib/unlock-streak-status.ts
      ├─ lists every contributor id with a persisted contribution
      │  (state/contributions.ts's listContributions + groupContributionsByContributor)
      └─ buildContributorUnlockStatusWithStreakFromStore() per contributor
          ├─ state/researchProgress.ts's getPersistedContributorProgress()
          │     → completed research-task count for this contributor
          ├─ lib/unlock-progress-status.ts   (tier — gated by both contribution
          │     stats AND completed-task count — unlocked skill level, tier
          │     badges, next-tier progress incl. tasksNeeded)
          └─ lib/gamified-quests.ts    (streak, streak badges, via state/dailyMissionResults.ts)
  → panels/ProgressUnlocksPanel.tsx        (renders the roster table)
  → apps/debate-ai.com/app/cards/progress/page.tsx  (mounts the panel as a route)
```

Every tier/badge/streak rule already existed and was Vitest-covered; this
feature adds one new composition function, `buildUnlockStatusRoster`
(`packages/debate-card-search/src/lib/unlock-streak-status.ts`), which lists
every contributor with a persisted contribution and resolves each one's
status through the already-existing `buildContributorUnlockStatusWithStreakFromStore`
— no new tier, badge, or streak logic was introduced.

A later slice, `lib/unlock-progress-status.ts`, closed "Research Progress
Tracking"'s own follow-up (c) — "feeding a contributor's topic-progress
history back into `progress-unlocks.ts`'s tier computation" — by adding a
`minCompletedTaskCount` gate on top of `progress-unlocks.ts`'s existing
volume/quality thresholds (`veteran` needs 5 completed tasks, `expert` needs
15, by default; `novice`/`apprentice` need none, so early progression is
unaffected). `unlock-streak-status.ts` now derives that count from
`state/researchProgress.ts`'s `getPersistedContributorProgress` and feeds it
through instead of using `progress-unlocks.ts`'s plain, task-blind tier
computation. Vitest-covered in
`packages/debate-card-search/test/unlock-streak-status.test.ts` (empty roster
when nothing is persisted, multiple contributors sorted alphabetically with
their own tier/streak, per-contributor data isolation, and the new
task-completion gate holding a contributor at a lower tier until they finish
enough tasks) and `packages/debate-card-search/test/unlock-progress-status.test.ts`
(tier computation, status building, and text rendering in isolation).

## Known gaps

- No contributor identity/auth scoping yet — the roster shows every
  contributor, the same known gap as the Leaderboard and Task Inbox panels.
- The `minCompletedTaskCount` thresholds (5 for veteran, 15 for expert) are
  illustrative defaults, not derived from any real product requirement.
