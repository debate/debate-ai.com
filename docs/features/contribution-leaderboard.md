# Contribution Leaderboard

Ranks community contributors — cards, summaries, analytics, and other research
contributions — by a blended helpfulness score, and shows each contributor's
unlock tier, earned badges, and current daily-quest streak.

- **Route:** `/cards/leaderboard`
- **Nav:** the Tools page's Community & Progress group; the Reason Editor's
  Workspace menu (`t leaderboard` in Ctrl/Cmd-Shift-Space's command palette)
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

A signed-in visitor's own row is highlighted with a "You" badge — see
"Signed-in row highlight" below. The leaderboard always shows every
contributor; nothing is filtered.

Each row has a "History" toggle that expands an inline endorsement history
list for that contributor — every endorsement made on their own
contributions, newest first, naming the endorsing reviewer, the endorsed
contribution's kind, the endorsement's credibility weight, and when it
happened. This closes idea #11's "An endorsement history list per
contributor" follow-up in TODO.md. `state/contributions.ts`'s
`recordPersistedEndorsement`/`recordPersistedEndorsementFromReviewer` now
stamp each `ReviewerEndorsement` with the endorsing `reviewerId` and an
`endorsedAt` timestamp (both optional on the type, so pre-existing
weight-only endorsements — recorded before this field existed, or a raw
scoring fixture — still typecheck and score normally, they just can't
appear in a history list); the new `listEndorsementsByContributor` lookup
reads those back out, filtering to entries that carry both fields. The
store also supports a `direction: "given"` query (endorsements a
contributor made as a reviewer, across every contributor's contributions),
not currently wired into this panel — a natural next follow-up if a
"my endorsement activity" view becomes useful.

Helpfulness score itself blends three signals (`lib/community-rating.ts`):
logarithmically-dampened popularity (likes/saves), a quality signal, and a
reviewer-credibility signal — so a contribution can't rank highly on raw
popularity alone. The "helpfulness score" mention in the panel's intro line
carries an Info-icon tooltip explaining that blend in plain language
(`buildHelpfulnessScoreExplanation`, shared with the Contributions Feed
panel's own tooltip) — the percentages shown are derived from
`HelpfulnessWeights`, not hardcoded, so the legend can't drift out of sync
with the actual scoring weights.

## Data flow

```
state/contributions.ts (localStorage)
  → buildPersistedLeaderboard()          — lib/contribution-leaderboard.ts
  → buildContributorUnlockStatusWithStreakFromStore()  — lib/unlock-streak-status.ts
      ├─ lib/progress-unlocks.ts   (tier, tier badges)
      └─ lib/gamified-quests.ts    (streak, streak badges, via state/dailyMissionResults.ts)
  → panels/ContributionLeaderboardPanel.tsx (renders the table)
  → apps/debate-ai.com/app/cards/leaderboard/page.tsx (mounts the panel as a route)

Signed-in row highlight (apps/debate-ai.com only):
components/research/ContributionLeaderboardWithIdentity.tsx  — "use client" wrapper
  → useSession()                          — lib/hooks/useSession.ts, the
                                              better-auth React session hook
  → deriveContributorIdFromSessionIdentity(user)
      — debate-card-search's lib/session-identity.ts: name, else the
        email's local part, else the raw account id, else ""
  → <ContributionLeaderboardPanel signedInContributorId={...} />
      → isOwnContributorRow(row.contributorId, signedInContributorId)
          — case-insensitive, trims both sides — adds a "You" badge and a
            highlight to that one row; the roster is never filtered
```

`app/cards/leaderboard/page.tsx` and `ResearchHub.tsx`'s Rewards tab both
render `ContributionLeaderboardWithIdentity` instead of
`ContributionLeaderboardPanel` directly, so the panel itself stays
app-agnostic — it only knows about a plain `signedInContributorId` string
prop, not `better-auth`. Unlike Task Inbox's "My tasks" field, this
leaderboard has no free-form id field to prefill — it always renders every
contributor — so the signed-in identity only highlights a matching row
instead.

Every scoring/tier/streak rule already existed and was Vitest-covered; this
feature is a read-only composition and rendering layer over those stores — it
introduces one new function, `buildPersistedLeaderboard`, which composes the
existing pure `buildLeaderboard` directly against the persisted contributions
store (see `packages/debate-card-search/test/contributions.test.ts`), and one
new pure helper, `isOwnContributorRow` (`lib/session-identity.ts`,
Vitest-covered in `test/session-identity.test.ts`).

## Cross-tab live update

`ContributionLeaderboardPanel` now subscribes to the browser's `storage`
event (which the spec fires only in *other* same-origin tabs/windows, never
the one that made the write), so a contribution, completed research task,
or quest/streak update logged in a second tab refreshes this tab's roster
without a manual reload. A new pure helper,
`state/live-update.ts`'s `isContributionLeaderboardLiveUpdateStorageEvent`,
checks whether the event's `key` is one of the roster-backing stores
(`contributions`, `completedResearchTasks`, `dailyMissionResults`), or
`null` for a `localStorage.clear()`; when it is, the panel re-derives the
whole roster via `buildLeaderboardRows()`. This closes, for this panel, the
"Every other localStorage-backed panel in this repo still has no cross-tab
live-update mechanism" Known gap noted in
[`shared-flow-sync.md`](shared-flow-sync.md), mirroring the existing
`DailyBestCardPanel`/`isDailyBestCardLiveUpdateStorageEvent` precedent.
Vitest-covered in
`packages/debate-card-search/test/live-update.test.ts` (every backing-store
key, the `null`-key clear-all case, and unrelated/substring-matching keys
staying ignored).

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
- The endorsement history list only renders `direction: "received"`; the
  store's `direction: "given"` query has no UI yet (see above).
