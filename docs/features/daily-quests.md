# Daily Quests

Team goals like "find 5 solvency cards" or "add 3 frontline answers today" —
a quest board that tracks live progress against real, same-day contribution
submissions.

- **Route:** `/cards/quests`
- **Nav:** the global dock's Settings menu → **Daily Quests**
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

Every saved quest template's progress for the current UTC calendar day:

| Field | Source |
| --- | --- |
| Description | `QuestTemplate.description` |
| Progress | `completedCount`/`targetCount`, from `lib/daily-quests.ts`'s `computeQuestProgress` |
| Complete | `isComplete`, once `completedCount >= targetCount` |

A quest can be added by hand (description, contribution kind, optional
argument block, target count), or seeded in bulk from a topic's
under-covered arguments (via the existing Topic Coverage Dashboard's
coverage report).

A "Your streak" section lets a contributor (identified by free-text id —
there is no contributor identity/auth in this repo, the same known gap as
`ContributionsFeedPanel`/`QuestStreaksPanel`) record today's mission result
on demand and see their reward right on the quest board itself: their
current streak, a badge freshly earned today (highlighted separately from
badges earned on prior days), and a nudge to keep the streak going when
today's mission isn't complete yet.

## Data flow

```
Submitting a contribution (Contributions Feed panel):
panels/ContributionsFeedPanel.tsx
  → saveContribution({ ..., submittedAt: Date.now(), argBlock? })  — state/contributions.ts
     (previously never stamped submittedAt/argBlock, so every quest/streak/
      challenge feature that keys off those fields was permanently starved
      of real data — see "Known gaps" in the prior features below)

Adding or seeding a quest (Daily Quests panel):
panels/DailyQuestsPanel.tsx
  → saveQuestTemplate(template)                              — state/dailyQuests.ts
  → seedQuestTemplatesFromTopicCoverage(topic)                — state/dailyQuests.ts
      buildPersistedTopicCoverageReport(topic)  — state/trackedArguments.ts
        → buildUnderCoveredArgumentQuests(report)             — lib/daily-quests.ts
        → saveQuestTemplate(...) per under-covered argument

Recording today's mission + reward (Daily Quests panel):
panels/DailyQuestsPanel.tsx
  → computeAndSavePersistedDailyMissionResult(contributorId, quests, now)
                                                                 — state/dailyMissionResults.ts
      (same composition as the Quest Streaks panel — see docs/features/quest-streaks.md)
  → buildPersistedContributorQuestStreak(contributorId, todayUtcDayKey())
                                                                 — state/dailyMissionResults.ts
      → buildContributorQuestStreak(...)                       — lib/gamified-quests.ts
  → buildStreakRewardText(streak, missionCompleteToday)         — lib/gamified-quests.ts
      missionCompleteToday := streak.lastCompletedDayKey === today's UTC day key

Rendering the board:
state/dailyQuests.ts (localStorage: dailyQuestTemplates)
state/contributions.ts (localStorage: contributions)
  → buildPersistedDailyQuestBoard(now)                        — state/dailyQuests.ts
      filters persisted contributions to those carrying a `submittedAt`
      (mirroring dailyMissionResults.ts's `hasSubmittedAt` convention), then
      hands both lists to lib/daily-quests.ts's buildDailyQuestBoard
  → panels/DailyQuestsPanel.tsx                                (renders the board)
  → apps/debate-ai.com/app/cards/quests/page.tsx                (mounts the panel)
```

`lib/daily-quests.ts`'s pure aggregation (`computeQuestProgress`,
`buildDailyQuestBoard`, `buildQuestBoardSummaryText`,
`buildUnderCoveredArgumentQuests`) already existed and was Vitest-covered;
this feature adds the persistence and UI it was missing —
`state/dailyQuests.ts` (closing follow-up (b), "a quest-board widget UI")
and wiring the board directly to the real, persisted contribution feed
(closing follow-up (a), "wiring real contribution-submission events into a
persisted daily feed"). Vitest-covered in
`packages/debate-card-search/test/dailyQuests.test.ts` (template CRUD,
corrupt-storage recovery, topic-coverage seeding — including upsert and
"nothing under-covered" — and board composition against real persisted
contributions, including day-scoping and the missing-`submittedAt`
exclusion).

A later slice closed follow-up (c), "a streak/reward layer once the
Gamified Quests idea's streak logic is composed in": `lib/gamified-quests.ts`
gained `buildStreakRewardText`, composing an already-built
`ContributorQuestStreak` (from `state/dailyMissionResults.ts`'s
`buildPersistedContributorQuestStreak` — the same helper `QuestStreaksPanel`
already used) into a short reward line, distinguishing a badge just earned
today from badges already earned on prior days. No changes were needed to
`state/dailyMissionResults.ts`, `state/dailyQuests.ts`, or any other
persistence/aggregation logic — this composes existing, already-persisted
building blocks into a new spot in the UI. Vitest-covered in
`packages/debate-card-search/test/gamified-quests.test.ts` (no streak yet,
continuing an existing streak, a plain non-milestone completion, a
freshly-earned milestone badge, not re-announcing a badge earned on a prior
day, and a custom milestone list).

## Known gaps

- No contributor identity/auth scoping yet — the board isn't scoped to "my
  quests," the same known gap as the Leaderboard, Task Inbox, and Progress
  Unlocks panels.
- Contributions saved before this change don't carry `submittedAt`/
  `argBlock` and are excluded from quest scoring (not retroactively
  backfilled).
- A quest template has no expiry — it keeps scoring every day until
  removed, rather than resetting or archiving after one "daily" cycle.
