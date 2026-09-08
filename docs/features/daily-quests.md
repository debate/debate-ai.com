# Daily Quests

Team goals like "find 5 solvency cards" or "add 3 frontline answers today" —
a quest board that tracks live progress against real, same-day contribution
submissions.

- **Route:** `/cards/quests`
- **Nav:** the Tools page's Community & Progress group; the Reason Editor's
  Workspace menu (`t quests` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-community`](../../packages/debate-contributor-progress/README.md)

## What it shows

Every saved quest template's progress for the current UTC calendar day:

| Field | Source |
| --- | --- |
| Description | `QuestTemplate.description` |
| Progress | `completedCount`/`targetCount`, from `lib/daily-quests.ts`'s `computeQuestProgress` |
| Complete | `isComplete`, once `completedCount >= targetCount` |

A quest can be added by hand (description, contribution kind, optional
argument block, target count, optional expiry day and — once an expiry is
set — an optional daily/weekly recurrence), or seeded in bulk from a topic's
under-covered arguments (via the existing Topic Coverage Dashboard's
coverage report).

A "Your streak" section lets a contributor (identified by free-text id —
there is no contributor identity/auth in this repo, the same known gap as
`ContributionsFeedPanel`/`QuestStreaksPanel`) record today's mission result
on demand and see their reward right on the quest board itself: their
current streak, a badge freshly earned today (called out in the reward
sentence and rendered as a filled "✨" chip, while badges earned on prior
days stay outlined — `lib/gamified-quests.ts#getFreshStreakBadge`), and a
nudge to keep the streak going when
today's mission isn't complete yet. A signed-in visitor sees this field
prefilled with their own id — see "Signed-in prefill" below.

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
      (template may carry an optional expiresOn UTC day key)
  → seedQuestTemplatesFromTopicCoverage(topic)                — state/dailyQuests.ts
      buildPersistedTopicCoverageReport(topic)  — state/trackedArguments.ts
        → buildUnderCoveredArgumentQuests(report)             — lib/daily-quests.ts
        → saveQuestTemplate(...) per under-covered argument

Cleaning up expired quests (Daily Quests panel):
panels/DailyQuestsPanel.tsx
  → pruneExpiredQuestTemplates(now)                           — state/dailyQuests.ts
      → rolloverExpiredRecurringQuestTemplates(now)            — state/dailyQuests.ts
          rolls an expired recurring template's expiresOn forward first, so
          it's never deleted as "expired" out from under a team
      removes every still-expired (non-recurring) stored template
      (isQuestTemplateExpired — lib/daily-quests.ts), returning the removed count
  → panel re-reads listQuestTemplates()/buildPersistedDailyQuestBoard() to refresh

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
      → rolloverExpiredRecurringQuestTemplates(now)            — state/dailyQuests.ts
          → rolloverRecurringQuestTemplate(template, dayKey)   — lib/daily-quests.ts
              advances an expired recurring template's expiresOn to its next
              cycle boundary on/after today, so it's back on the board with
              fresh (today-scoped) progress — no manual action needed
      filters persisted contributions to those carrying a `submittedAt`
      (mirroring dailyMissionResults.ts's `hasSubmittedAt` convention), then
      hands both lists to lib/daily-quests.ts's buildDailyQuestBoard
  → panels/DailyQuestsPanel.tsx                                (renders the board)
  → apps/debate-ai.com/app/cards/quests/page.tsx                (mounts the panel)

Signed-in prefill for "Your streak" (apps/debate-ai.com only):
components/research/DailyQuestsWithIdentity.tsx  — "use client" wrapper
  → useSession()                          — lib/hooks/useSession.ts, the
                                              better-auth React session hook
  → deriveContributorIdFromSessionIdentity(user)
      — debate-research-evidence's lib/session-identity.ts: name, else the
        email's local part, else the raw account id, else ""
  → <DailyQuestsPanel signedInContributorId={...} />
      — seeds contributorId's initial value only (and immediately loads that
        contributor's streak); a visitor who edits the field
        (hasEditedContributorId) keeps their own typed value from then on,
        mirroring TaskInboxPanel's "My tasks" prefill exactly
```

`app/cards/quests/page.tsx` and `ResearchHub.tsx`'s Quests tab both render
`DailyQuestsWithIdentity` instead of `DailyQuestsPanel` directly, so the
panel itself stays app-agnostic — it only knows about a plain
`signedInContributorId` string prop, not `better-auth`.

## News Stream celebration

Recording today's mission on a day that completes every quest on the board
now posts to the [News Stream](news-stream.md) automatically — no separate
"announce" step, mirroring the Quest Streaks milestone, Group Challenge
completion, and Argument Library submission sources that already feed that
same page. `state/dailyMissionResults.ts`'s new
`buildDailyQuestCompletionEvents()` reads every persisted
`DailyMissionResultRecord` where `isComplete` is true (no new store — the
"Record today's mission" action already saves one of these on every visit)
and `state/newsStream.ts`'s new `dailyQuestCompletionNews()` renders each
as a `NewsItem` via `lib/gamified-quests.ts`'s new
`buildDailyQuestCompletionAnnouncementText`. Unlike a streak milestone
(which only fires on a rare milestone-length crossing), a board can be
completed every single day, so this source shares `sprintNoteNews()`'s/
`argumentLibraryNews()`'s `MAX_COMMUNITY_ITEMS_PER_SOURCE` volume cap
(the 20 most recent completions) rather than posting every one unbounded.

`lib/daily-quests.ts`'s pure aggregation (`computeQuestProgress`,
`buildDailyQuestBoard`, `buildQuestBoardSummaryText`,
`buildUnderCoveredArgumentQuests`) already existed and was Vitest-covered;
this feature adds the persistence and UI it was missing —
`state/dailyQuests.ts` (closing follow-up (b), "a quest-board widget UI")
and wiring the board directly to the real, persisted contribution feed
(closing follow-up (a), "wiring real contribution-submission events into a
persisted daily feed"). Vitest-covered in
`packages/debate-team-collaboration/test/dailyQuests.test.ts` (template CRUD,
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
`packages/debate-contributor-progress/test/gamified-quests.test.ts` (no streak yet,
continuing an existing streak, a plain non-milestone completion, a
freshly-earned milestone badge, not re-announcing a badge earned on a prior
day, and a custom milestone list).

A quest template can now carry an optional expiry, closing the "a quest
template has no expiry" Known gap: `QuestTemplate.expiresOn` (a UTC day key,
same `getUtcDayKey` convention as everywhere else in this module) is
optional and, when set, `isQuestTemplateExpired`/`buildDailyQuestBoard`
(`lib/daily-quests.ts`) exclude that template from the board once the
current UTC day is past it — an expired quest simply stops appearing and
stops scoring, rather than being reset for a new cycle (no recurring-quest
concept exists in this repo). `state/dailyQuests.ts`'s
`pruneExpiredQuestTemplates` additionally removes expired templates from the
stored roster entirely, and the panel's new "Clean up expired quests" action
calls it. The "Add quest" form gained an optional "Expires on" date field,
and each quest's board row shows an "Expires <date>" badge when its
template has one. Vitest-covered in
`packages/debate-team-collaboration/test/daily-quests.test.ts`
(`isQuestTemplateExpired`: no `expiresOn`, on/before/after the expiry day;
`buildDailyQuestBoard`: excludes an expired template, still includes one on
its own expiry day) and
`packages/debate-team-collaboration/test/dailyQuests.test.ts`
(`pruneExpiredQuestTemplates`: no-op on empty storage, removes an expired
template and returns the count, leaves a never-expiring or not-yet-expired
template untouched, and removes only the expired template among several).

A quest template can now also carry a recurrence cadence, closing the "an
expired quest simply stops appearing and stops scoring, rather than being
reset for a new cycle (no recurring-quest concept exists in this repo)"
Known gap left by the expiry addition above: `QuestTemplate.recurrence`
(`"daily"` | `"weekly"`, `lib/daily-quests.ts`) has no effect without an
`expiresOn` to anchor it, but once a recurring template's cycle expires,
`rolloverRecurringQuestTemplate` advances `expiresOn` forward by whole
cycles until it lands on/after the current UTC day instead of leaving the
template expired — the quest simply becomes active again, scored fresh
against that day's contributions (progress was always day-scoped, so no
separate "reset the count" step is needed). `state/dailyQuests.ts`'s
`rolloverExpiredRecurringQuestTemplates` applies that to every persisted
template and is called automatically by both `buildPersistedDailyQuestBoard`
(so a recurring quest reappears the next time anyone loads the board — no
scheduled job exists in this repo, matching every other "manual trigger"
convention here) and `pruneExpiredQuestTemplates` (so "Clean up expired
quests" can never delete a recurring template out from under a team). The
"Add quest" form gained a "Recurs" picker (Doesn't recur / Daily / Weekly),
shown once an expiry date is set, and each quest's board row shows a
"Recurs daily"/"Recurs weekly" badge alongside its "Expires" badge when it
has one. Vitest-covered in
`packages/debate-team-collaboration/test/daily-quests.test.ts`
(`rolloverRecurringQuestTemplate`: no recurrence, recurrence with no
`expiresOn`, not-yet-expired, daily rollover to today, weekly rollover to
the next 7-day boundary, and a weekly rollover skipping several missed
cycles at once) and
`packages/debate-team-collaboration/test/dailyQuests.test.ts`
(`rolloverExpiredRecurringQuestTemplates`: no-op on empty storage, leaves a
non-recurring expired template untouched, rolls an expired recurring
template forward and returns the count, leaves a not-yet-expired recurring
template untouched, and rolls over only the expired recurring templates
among several; `pruneExpiredQuestTemplates` never removing an expired
recurring template; `buildPersistedDailyQuestBoard` rolling a recurring
template's next cycle back onto the board at 0 progress).

## Previewing a coverage-seeded quest set before creating it

Closes the "a preview of the quests a coverage gap would seed before
creating them" follow-up named under the "📊 Topic Coverage Dashboard" bullet
in TODO.md. Before this, "Seed quests" wrote straight to the stored roster
with no way to see what it would do first. The "Seed from a topic's coverage
gaps" section now has a "Preview" button alongside "Seed quests": it calls
`state/dailyQuests.ts`'s new `previewQuestTemplatesFromTopicCoverage(topic)`,
which derives the exact same `QuestTemplate[]`
`seedQuestTemplatesFromTopicCoverage` would save (composing
`buildPersistedTopicCoverageReport` and `buildUnderCoveredArgumentQuests`
exactly as seeding does) but only *reads* the stored roster rather than
writing to it. Each previewed entry is flagged `alreadySeeded` when a
template with that exact id is already stored, since seeding an
already-present id upserts it in place instead of adding a new quest — the
panel renders that as an "Already on board" badge next to "New" for the
rest, plus a summary line ("Seeding would add N new quests (M total for
this topic's gaps)"). Editing the topic field clears any stale preview for
the previous topic, and a successful "Seed quests" clears the preview too
(the board itself now reflects it). Vitest-covered in
`packages/debate-team-collaboration/test/dailyQuests.test.ts`
(`previewQuestTemplatesFromTopicCoverage`: derives the same template seeding
would save without writing anything, flags an already-seeded template,
returns an empty list for a topic with nothing under-covered, and doesn't
mistake an unrelated stored custom quest for an already-seeded one).

## Cross-tab live update

`DailyQuestsPanel` subscribes to the browser's `storage` event (fires only
in *other* same-origin tabs/windows, never the one that made the write) via
`state/live-update.ts`'s `isDailyQuestsLiveUpdateStorageEvent` and refreshes
the board (and, if a contributor id is entered, their streak) when it fires
for its backing `dailyQuestTemplates`, `contributions`, or
`dailyMissionResults` keys — so a quest added, a contribution submitted, or
a mission result recorded in a second tab now refreshes this tab's view
without a manual reload — closing the "Every other localStorage-backed
panel in this repo still has no cross-tab live-update mechanism" Known gap
noted in [`shared-flow-sync.md`](./shared-flow-sync.md), for this panel.
Vitest-covered in `packages/debate-search-evidence/test/live-update.test.ts`.

## Quest difficulty tiers

Closes the "quest difficulty tiers" follow-up named under the "🎯 Daily
Quests and Targets" bullet in TODO.md. A quest template can now carry an
`easy`/`medium`/`hard` `difficulty` (`lib/daily-quests.ts`'s
`QuestDifficulty`, mirroring `drill-generator.ts`'s `DrillDifficulty` naming
exactly), worth an escalating point value once complete
(`QUEST_DIFFICULTY_POINTS`: 5/10/20). A template saved before this field
existed has no `difficulty` at all — `getQuestDifficulty` treats that as
`"medium"` (`DEFAULT_QUEST_DIFFICULTY`) rather than requiring a one-time
backfill, and `getQuestDifficultyPoints` composes that fallback directly.

The "Add quest" form gained a "Difficulty" picker (defaulting to Medium),
and each board row now shows a "`<tier>` · N pts" badge next to its
progress badge (`computeQuestProgress`'s new `difficulty`/`points` fields
on `QuestProgress`). A quest seeded from a topic's under-covered arguments
is rated automatically by how many more cards it still needs
(`remainingCardsToQuestDifficulty`: 1 remaining is easy, 2 is medium, 3+ is
hard) rather than always landing on the default tier.

A "Difficulty" filter above the board (All/Easy/Medium/Hard,
`filterQuestBoardByDifficulty`) narrows the rendered list to one tier at a
time, mirroring the AI Drill Generator's own difficulty filter. The board
header also reports a running points tally —
`buildQuestBoardPointsSummaryText` renders "N/M points earned today",
summing `points` across every complete quest against every quest's point
value on the board (`buildQuestBoardPointsSummary`).

Vitest-covered in `packages/debate-team-collaboration/test/daily-quests.test.ts`
(`remainingCardsToQuestDifficulty`'s three bands; `getQuestDifficulty`/
`getQuestDifficultyPoints` defaulting an undifficultied template to medium
and passing an explicit difficulty through; `computeQuestProgress` carrying
a template's difficulty/points onto its progress; `filterQuestBoardByDifficulty`
narrowing to one tier or returning everything for "all"; and
`buildQuestBoardPointsSummary`/`buildQuestBoardPointsSummaryText` tallying
earned-vs-total points, including the empty-board case) and updated
`buildUnderCoveredArgumentQuests` cases asserting the seeded difficulty.

## Team-vs-team quest competitions

Closes the "team-vs-team quest competitions" follow-up named under the "🎯
Daily Quests and Targets" bullet in TODO.md. A "Team competition" section on
the panel lets a team be created from a name plus a comma-separated list of
contributor ids (`lib/daily-quests.ts`'s `QuestTeam`, persisted under its own
`state/dailyQuests.ts` `"questTeams"` localStorage key — independent of the
quest-template roster, since a team roster and the quest board itself vary
independently). Once at least one team exists, its standing renders
alongside any others: each team's score is the sum of its own members' points
earned today, not just whichever single member is furthest ahead, via a new
`computeContributorQuestPoints` (scores one contributor's own points by
narrowing the shared contribution feed to just their own contributions first,
then reusing `buildDailyQuestBoard`/`buildQuestBoardPointsSummary` exactly as
the individual board already does) and `buildTeamQuestCompetitionStandings`
(sums each team's members' points, sorted by earned points descending,
tie-broken by team id). `state/dailyQuests.ts`'s
`buildPersistedTeamQuestCompetition` composes this against the exact same
persisted quest-template roster and real, persisted contribution feed
`buildPersistedDailyQuestBoard` already reads.

The panel shows a 🏆 next to the current leader (once it has scored above
zero) and a per-member points breakdown underneath each team's row, so a
coach can see who on the losing team is pulling their weight. A team can be
removed with a "Remove" action. The section also participates in the
existing cross-tab live-update mechanism (`"questTeams"` was added to
`DAILY_QUESTS_LIVE_UPDATE_STORAGE_KEYS`), so a team added/removed in another
tab refreshes the standings here too.

Vitest-covered in `packages/debate-team-collaboration/test/daily-quests.test.ts`
(`computeContributorQuestPoints`: scores only a contributor's own
contributions, zero for no matches; `buildTeamQuestCompetitionStandings`:
sums members' points per team, ranks by earned points descending, tie-breaks
by team id, scores a member-less team as 0/0, and returns an empty list for
no teams) and
`packages/debate-team-collaboration/test/dailyQuests.test.ts`
(`listQuestTeams`/`saveQuestTeam`/`deleteQuestTeam`: empty/corrupt-storage
recovery, listing, upsert, delete, and no-op deleting an unstored id;
`buildPersistedTeamQuestCompetition`: empty list with no stored teams, and
ranking stored teams against the real, persisted quest roster and
contribution feed).

## Known gaps

- No contributor identity/permission *checks* — the "Your streak" field
  stays free-form text, not a login, so anyone can still type any
  contributor's id to record a mission or view a streak under it. A real
  signed-in session now *prefills* the field when one exists (see
  "Signed-in prefill" above), but nothing stops a visitor from overwriting
  it — the same known gap as the Leaderboard, Task Inbox, and Progress
  Unlocks panels.
- Contributions saved before this change don't carry `submittedAt`/
  `argBlock` and are excluded from quest scoring (not retroactively
  backfilled).
- Team rosters are local to a browser, not account-synced — the same known
  gap as the quest-template roster itself. A team's contributor ids are
  free-form text with no membership check against a real coaching-program
  roster (`debate-community`'s `CoachingProgramConfig`) or any other
  contributor list.
