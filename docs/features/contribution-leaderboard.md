# Contribution Leaderboard

Ranks community contributors — cards, summaries, analytics, and other research
contributions — by a blended helpfulness score, and shows each contributor's
unlock tier, earned badges, and current daily-quest streak.

- **Route:** `/cards/leaderboard`
- **Nav:** the global dock's Settings menu → **Leaderboard**
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

| Column | Source |
| --- | --- |
| Rank | Position in `buildLeaderboard`'s sort order (total helpfulness score, descending) |
| Contributor | `contributorId` |
| Tier | `novice` / `apprentice` / `veteran` / `expert`, from `lib/progress-unlocks.ts` |
| Contributions | Count of persisted contributions attributed to that contributor |
| Total score | Sum of each contribution's blended helpfulness score |
| Avg score | Total score divided by contribution count |
| Streak | Current consecutive-day quest streak, from `lib/gamified-quests.ts` |
| Badges | Tier badges + streak-milestone badges, merged by `lib/unlock-streak-status.ts` |

Helpfulness score itself blends three signals (`lib/community-rating.ts`):
logarithmically-dampened popularity (likes/saves), a quality signal, and a
reviewer-credibility signal — so a contribution can't rank highly on raw
popularity alone.

## Data flow

```
state/contributions.ts (localStorage)
  → buildPersistedLeaderboard()          — lib/contribution-leaderboard.ts
  → buildContributorUnlockStatusWithStreakFromStore()  — lib/unlock-streak-status.ts
      ├─ lib/progress-unlocks.ts   (tier, tier badges)
      └─ lib/gamified-quests.ts    (streak, streak badges, via state/dailyMissionResults.ts)
  → panels/ContributionLeaderboardPanel.tsx (renders the table)
  → apps/debate-ai.com/app/cards/leaderboard/page.tsx (mounts the panel as a route)
```

Every scoring/tier/streak rule already existed and was Vitest-covered; this
feature is a read-only composition and rendering layer over those stores — it
introduces one new function, `buildPersistedLeaderboard`, which composes the
existing pure `buildLeaderboard` directly against the persisted contributions
store (see `packages/debate-card-search/test/contributions.test.ts`).

## Known gaps

- No real submitted-contribution flow exists yet — the store only has
  whatever a caller (or, currently, nothing in the UI) calls `saveContribution`
  with. The leaderboard is empty until contributions are persisted some other
  way (e.g. via a future card-submission flow).
- No like/save/endorse UI wired to `recordPersistedLike`/`recordPersistedSave`/
  `recordPersistedEndorsement` yet.
- No reviewer-identity/permission checks (no auth/roles in this repo yet).
