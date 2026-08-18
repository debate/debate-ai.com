# Quest Streaks

A roster of every contributor's daily-quest streak and the milestone badges
it has earned, plus an on-demand action to compute and save today's mission
result.

- **Route:** `/cards/streaks`
- **Nav:** the global dock's Settings menu → **Quest Streaks**
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

Every contributor with at least one persisted daily mission result:

| Field | Source |
| --- | --- |
| Contributor | `ContributorQuestStreak.contributorId` |
| Current streak | `streak.currentStreak`, from `lib/gamified-quests.ts`'s `computeStreakStatus` |
| Longest streak | `streak.longestStreak` |
| Last completed | `streak.lastCompletedDayKey` |
| Badges | `earnedBadges`, milestones from `DEFAULT_STREAK_MILESTONES` (3/7/14/30-day) |

A "Run today's mission check" action lets a contributor (identified by
free-text id — there is no contributor identity/auth in this repo, the same
known gap as `DailyQuestsPanel`/`ContributionsFeedPanel`) compute and save
their own mission result for the current UTC calendar day on demand, against
today's saved quest templates and their real, persisted contributions.

## Data flow

```
Running today's mission check (Quest Streaks panel):
panels/QuestStreaksPanel.tsx
  → listQuestTemplates()                                      — state/dailyQuests.ts
  → computeAndSavePersistedDailyMissionResult(contributorId, quests, now)
                                                                 — state/dailyMissionResults.ts
      listContributionsByContributor(contributorId)             — state/contributions.ts
        (filtered to those carrying a `submittedAt` timestamp)
      → buildDailyQuestBoard(quests, contributions, now)        — lib/daily-quests.ts
      → computeDailyMissionResult(board, dayKey)                — lib/gamified-quests.ts
      → saveDailyMissionResult(record)                          — state/dailyMissionResults.ts (upsert)

Rendering the roster:
state/dailyMissionResults.ts (localStorage: dailyMissionResults)
  → buildPersistedQuestStreakRoster(todayUtcDayKey())
      buildPersistedContributorQuestStreak(contributorId, asOfDayKey)  per contributor
        → buildContributorQuestStreak(...)                      — lib/gamified-quests.ts
  → panels/QuestStreaksPanel.tsx                                 (renders the roster)
  → apps/debate-ai.com/app/cards/streaks/page.tsx                 (mounts the panel)
```

`lib/gamified-quests.ts`'s pure streak/badge computation
(`computeDailyMissionResult`, `computeStreakStatus`, `getEarnedStreakBadges`,
`buildContributorQuestStreak`, `buildStreakSummaryText`) and
`state/dailyMissionResults.ts`'s persistence layer already existed and were
Vitest-covered; this change closes the remaining follow-up under the "🎮
Gamified Quests" bullet in TODO.md — "a real trigger, i.e. a UI action or
scheduled job, to call `computeAndSavePersistedDailyMissionResult` on an
actual cadence" — with a UI action. No scheduled-job/cron infrastructure
exists in this repo (the whole feature is client-side, localStorage-backed),
so a truly automatic daily cadence remains a documented gap below.

## Known gaps

- The trigger is manual (a button click), not an automatic scheduled job —
  no cron/scheduled-task infrastructure exists in this repo to run it on a
  real daily cadence unattended.
- No contributor identity/auth scoping yet — a contributor runs their own
  check by typing their id, the same known gap as the Leaderboard, Task
  Inbox, Daily Quests, and Progress Unlocks panels.
- Running the check composes whichever quest templates happen to be saved
  in `state/dailyQuests.ts` at that moment; a template added after a
  contributor's check runs isn't retroactively counted until they run the
  check again.
