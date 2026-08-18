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

## Known gaps

- Follow-up (c), a streak/reward layer once the Gamified Quests idea's
  streak logic is composed in, remains open — not started.
- No contributor identity/auth scoping yet — the board isn't scoped to "my
  quests," the same known gap as the Leaderboard, Task Inbox, and Progress
  Unlocks panels.
- Contributions saved before this change don't carry `submittedAt`/
  `argBlock` and are excluded from quest scoring (not retroactively
  backfilled).
- A quest template has no expiry — it keeps scoring every day until
  removed, rather than resetting or archiving after one "daily" cycle.
