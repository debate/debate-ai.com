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

- The Contributions Feed panel (`/cards/contributions`) now submits
  contributions and wires `recordPersistedLike`/`recordPersistedSave`/
  `recordPersistedEndorsementFromReviewer`, so the leaderboard populates from
  real UI activity, not just direct `saveContribution` calls.
- Endorsement weight is now derived from the endorsing reviewer's own
  persisted contribution history (`community-rating.ts`'s
  `computeReviewerCredibility`) instead of a fixed placeholder — a reviewer
  with no contributions of their own still gets a low, non-zero
  `MIN_REVIEWER_CREDIBILITY` weight.
- No reviewer-identity/permission checks (no auth/roles in this repo yet) —
  a "Reviewer ID" is just a typed string, so nothing stops one person from
  endorsing under many different reviewer ids to inflate an endorsement's
  weight.
