# Quest Streaks

A roster of every contributor's daily-quest streak and the milestone badges
it has earned, plus an on-demand action to compute and save today's mission
result.

- **Route:** `/cards/streaks`
- **Nav:** the Tools page's Community & Progress group; the Reason Editor's
  Workspace menu (`t streaks` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

Every contributor with at least one persisted daily mission result or streak
freeze:

| Field | Source |
| --- | --- |
| Contributor | `ContributorQuestStreak.contributorId` |
| Current streak | `streak.currentStreak`, from `lib/gamified-quests.ts`'s `computeStreakStatus` (with any persisted streak freezes bridged in) |
| Longest streak | `streak.longestStreak` |
| Last completed | `streak.lastCompletedDayKey` |
| Badges | `earnedBadges`, milestones from `DEFAULT_STREAK_MILESTONES` (3/7/14/30-day) |
| Streak freeze | Remaining freeze allowance, plus a "Use a grace day" action when yesterday broke an in-progress streak |
| Reminder | An opt-in 🔔 toggle, plus a warning banner when opted in and the streak is at risk of lapsing today |

A "Run today's mission check" action lets a contributor (identified by
free-text id — there is no contributor identity/auth in this repo, the same
known gap as `DailyQuestsPanel`/`ContributionsFeedPanel`) compute and save
their own mission result for the current UTC calendar day on demand, against
today's saved quest templates and their real, persisted contributions.

## Streak freeze / grace day

A contributor who misses a day doesn't have to watch their streak reset to
zero — they can spend a **streak freeze** ("grace day") on the missed day
instead, which counts as if that day's mission had been completed for the
purposes of computing their streak length and milestone badges.

- **Allowance:** up to `MAX_STREAK_FREEZES_PER_WINDOW` (2) freezes per
  rolling `STREAK_FREEZE_WINDOW_DAYS` (30) day window
  (`lib/gamified-quests.ts#getAvailableStreakFreezes`) — a freeze used more
  than 30 days ago no longer counts against the allowance, so it replenishes
  over time rather than being a one-time lifetime cap.
- **Eligibility:** only the single most recent missed day — the day right
  before today — can be frozen, and only when it actually broke a streak
  that was active the day before it
  (`lib/gamified-quests.ts#findFreezableStreakGapDayKey`). A day that was
  already completed, already frozen, or in the future can't be frozen
  (`lib/gamified-quests.ts#canApplyStreakFreeze`). A gap wider than one day
  needs a freeze applied one day at a time as each becomes the most recent
  gap.
- **Applying a freeze:** the panel's "Streak freeze" column shows a "Use a
  grace day for `YYYY-MM-DD`" button whenever a contributor has an eligible
  gap day and at least one freeze remaining; clicking it calls
  `state/streakFreezes.ts#applyPersistedStreakFreeze`, which re-validates and
  saves the freeze, then refreshes the roster.
- **Persistence:** freezes are stored per contributor per day in a new
  `streakFreezes` localStorage key (`state/streakFreezes.ts`), mirroring
  `dailyMissionResults.ts`'s persistence convention. Frozen days are merged
  into a contributor's mission-result history
  (`lib/gamified-quests.ts#applyStreakFreezes`) before every streak/badge
  computation, so no changes were needed to `computeStreakStatus`,
  `getEarnedStreakBadges`, or `deriveEarnedStreakMilestoneEvents` themselves
  — a frozen day just looks like a completed one to those functions.

## Streak-lapse reminder

A contributor can opt in to a reminder that warns them, right on the panel,
when their streak is about to lapse — the "🎮 Gamified Quests" bullet's "an
opt-in reminder notification before a streak lapses" follow-up.

- **What "at risk" means:** an in-progress streak coming into today (i.e.
  yesterday's streak was greater than zero) where today's mission hasn't been
  completed yet — `lib/gamified-quests.ts#getStreakLapseRiskLength`. This is
  deliberately proactive: unlike the streak-freeze mechanic above (which
  offers a freeze *after* a gap day has already passed), this fires *while*
  today can still be saved by completing today's mission, so no freeze is
  needed. It returns `null` (nothing to warn about) once today's mission is
  already complete, or when there was no streak in progress to begin with.
- **Opting in:** each roster row has a "🔕 Remind me" / "🔔 Reminder on"
  toggle button. Opting in is per contributor id (there is no contributor
  identity/auth in this repo, the same known gap as the rest of this panel),
  persisted in a new `streakLapseReminders` localStorage key
  (`state/streakLapseReminders.ts`), mirroring `streakFreezes.ts`'s
  persistence convention.
- **The reminder itself:** once opted in, a row shows a warning line
  (`lib/gamified-quests.ts#buildStreakLapseReminderText`, e.g. "⏰ Your 5-day
  streak will end today unless you complete today's quests!") whenever that
  contributor is at risk. There is no push-notification/scheduled-job
  infrastructure in this repo — the "notification" is this in-app banner,
  seen whenever a contributor visits the panel while at risk, not a real push
  notification delivered outside the app.

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
state/streakFreezes.ts (localStorage: streakFreezes)
  → buildQuestStreakRosterWithFreezes(todayUtcDayKey())          — state/streakFreezes.ts
      buildContributorQuestStreakWithFreezes(contributorId, asOfDayKey)  per contributor
        listDailyMissionResultsForContributor(contributorId)     — state/dailyMissionResults.ts
        listStreakFreezeDayKeysForContributor(contributorId)     — state/streakFreezes.ts
        → applyStreakFreezes(results, frozenDayKeys)             — lib/gamified-quests.ts
        → buildContributorQuestStreak(...)                       — lib/gamified-quests.ts
  → panels/QuestStreaksPanel.tsx                                 (renders the roster)
  → apps/debate-ai.com/app/cards/streaks/page.tsx                 (mounts the panel)

Using a grace day (Quest Streaks panel, "Streak freeze" column):
panels/QuestStreaksPanel.tsx
  → findFreezableStreakGapDayKey(results, frozenDayKeys, asOfDayKey)
                                                                   — lib/gamified-quests.ts
      (shows the "Use a grace day for …" button when non-null)
  → applyPersistedStreakFreeze(contributorId, gapDayKey, asOfDayKey)
                                                                   — state/streakFreezes.ts
      canApplyStreakFreeze(...)                                   — lib/gamified-quests.ts (validates)
      writeAll([...existing, record])                             — state/streakFreezes.ts (saves)
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

## Cross-tab live update

`QuestStreaksPanel` subscribes to the browser's `storage` event (fires only
in *other* same-origin tabs/windows, never the one that made the write) via
`state/live-update.ts`'s `isQuestStreaksLiveUpdateStorageEvent` and
re-derives the roster when it fires for its backing `dailyMissionResults`,
`streakFreezes`, or `streakLapseReminders` key, so a mission check, a
grace-day freeze, or a reminder opt-in applied in a second tab now refreshes
this tab's roster without a manual reload — closing
the "Every other localStorage-backed panel in this repo still has no
cross-tab live-update mechanism" Known gap noted in
[`shared-flow-sync.md`](./shared-flow-sync.md), for this panel.
Vitest-covered in `packages/debate-card-search/test/live-update.test.ts`.

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
- Streak freezes are localStorage-only, not account-synced across devices —
  the same known gap as most of this panel's own history, unlike
  `wordLimitPresets`/coach materials/etc.
- The "Use a grace day" action only ever surfaces the single most recent
  missed day; a contributor who missed several days in a row needs to spend
  a freeze, refresh, and repeat once each newly-exposed gap becomes the most
  recent one.
- The freeze allowance (2 per rolling 30 days) is a fixed constant, not
  earned through activity (e.g. a freeze awarded per streak milestone
  reached) — a simple flat grant for this first slice.
- The streak-lapse reminder is an in-app banner only, seen when a contributor
  happens to visit the panel while at risk — there's no real push
  notification (email, browser push, etc.) that would reach them without
  opening the app, since no such delivery infrastructure exists in this
  repo.
- Reminder opt-ins are localStorage-only, not account-synced across devices —
  the same known gap as streak freezes above.
