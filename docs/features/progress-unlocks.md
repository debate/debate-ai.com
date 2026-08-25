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

A signed-in visitor's own row is highlighted with a "You" badge — see
"Signed-in row highlight" below. The roster always shows every contributor;
nothing is filtered.

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

Signed-in row highlight (apps/debate-ai.com only):
components/research/ProgressUnlocksWithIdentity.tsx  — "use client" wrapper
  → useSession()                          — lib/hooks/useSession.ts, the
                                              better-auth React session hook
  → deriveContributorIdFromSessionIdentity(user)
      — debate-card-search's lib/session-identity.ts: name, else the
        email's local part, else the raw account id, else ""
  → <ProgressUnlocksPanel signedInContributorId={...} />
      → isOwnContributorRow(status.contributorId, signedInContributorId)
          — case-insensitive, trims both sides — adds a "You" badge and a
            highlight to that one row; the roster is never filtered
```

`app/cards/progress/page.tsx` and `ResearchHub.tsx`'s Progress tab both
render `ProgressUnlocksWithIdentity` instead of `ProgressUnlocksPanel`
directly, so the panel itself stays app-agnostic — it only knows about a
plain `signedInContributorId` string prop, not `better-auth`. Unlike Task
Inbox's "My tasks" field, this roster has no free-form id field to prefill —
it always renders every contributor — so the signed-in identity only
highlights a matching row instead.

Every tier/badge/streak rule already existed and was Vitest-covered; this
feature adds one new composition function, `buildUnlockStatusRoster`
(`packages/debate-card-search/src/lib/unlock-streak-status.ts`), which lists
every contributor with a persisted contribution and resolves each one's
status through the already-existing `buildContributorUnlockStatusWithStreakFromStore`
— no new tier, badge, or streak logic was introduced. Vitest-covered in
`packages/debate-card-search/test/unlock-streak-status.test.ts` (empty roster
when nothing is persisted, multiple contributors sorted alphabetically with
their own tier/streak, and per-contributor data isolation). The signed-in
highlight adds one new pure helper, `isOwnContributorRow`
(`lib/session-identity.ts`, Vitest-covered in `test/session-identity.test.ts`).

A later slice closed this page's own "Known gaps" follow-up — see
[Research Progress Tracking](./research-progress-tracking.md) for the
completed-task-as-tier-signal change.

## Known gaps

- No contributor identity/permission *checks* — a real signed-in session now
  *highlights* the visitor's own row (see "Signed-in row highlight" above),
  but the roster still shows and never scopes to every contributor, the same
  "prefill/highlight only, not a gate" known gap the Leaderboard and Task
  Inbox panels carry.
- No topic/task-level progress breakdown here — that's the separate
  "Research Progress Tracking" idea in `TODO.md`.
