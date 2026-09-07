# Contribution Leaderboard

Ranks community contributors — cards, summaries, analytics, and other research
contributions — by a blended helpfulness score, and shows each contributor's
unlock tier, earned badges, and current daily-quest streak.

- **Route:** `/cards/leaderboard`
- **Nav:** the Tools page's Community & Progress group; the Reason Editor's
  Workspace menu (`t leaderboard` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-community`](../../packages/debate-contributor-progress/README.md)

## What it shows

| Column | Source |
| --- | --- |
| Rank | Position in `buildLeaderboard`'s sort order (total helpfulness score, descending) |
| Contributor | `contributorId` |
| Tier | `novice` / `apprentice` / `veteran` / `expert`, from `lib/progress-unlocks.ts` |
| Contributions | Count of persisted contributions attributed to that contributor |
| Total score | Sum of each contribution's blended helpfulness score |
| Avg score | Total score divided by contribution count |
| Completed tasks | Count of verified routed research tasks, from `debate-team-collaboration`'s `state/researchProgress.ts` (blank when a Category filter other than "All kinds" is active) |
| Streak | Current consecutive-day quest streak (freeze-bridged, matching `/cards/streaks`), from `lib/gamified-quests.ts` |
| Badges | Tier badges + streak-milestone badges, merged by `lib/unlock-streak-status.ts` |
| Endorsements | A per-row "History" toggle expanding that contributor's received-endorsement history |

A signed-in visitor's own row is highlighted with a "You" badge — see
"Signed-in row highlight" below. Within a chosen range and category (see
"Range filter" and "Category filter" below) the leaderboard shows every
contributor with activity in that window/category; nothing else is
filtered.

## Range filter

A "Range" dropdown above the table — **All time** (default), **This
week**, or **This month** — closes the "weekly/monthly/all-time range
filters" follow-up named under the "Contribution Leaderboard" bullet in
`TODO.md`. Switching it re-derives the whole roster (rank, scores, and
completed-task counts) from only the activity in that trailing window:

- `lib/contribution-leaderboard.ts`'s `filterContributionsByRange` narrows
  the contribution list to those whose `submittedAt` falls in the last 7
  (weekly) or 30 (monthly) days, ending at the moment the panel renders. A
  contribution saved before `submittedAt` existed (or by a caller that
  doesn't set it) has no dated home, so it's excluded from `weekly`/
  `monthly` but still counted under `all-time`.
- `state/researchProgress.ts`'s `buildPersistedLeaderboardWithCompletedTasks`
  now takes an optional `range` (and `now`) argument and applies the same
  window, via the shared `isWithinLeaderboardRange` helper, to each
  contributor's completed-task count (keyed off `CompletedTaskRecord.completedAt`)
  — so switching range changes every column consistently instead of only
  the contribution-based ones.
- A contributor with no activity in the chosen window drops off the
  roster entirely for that range (they still appear under `all-time`).
  Switching back to **All time** always restores the full roster.

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
contributor made as a reviewer, across every contributor's contributions) —
now wired into a "My endorsement activity" toggle, shown above the table
only for a signed-in visitor (`signedInContributorId`), rendering that same
list with the reviewer/recipient roles swapped ("You endorsed
{contributor}'s {kind}" instead of "{reviewer} endorsed a {kind}"). Both
directions share the same `EndorsementHistoryList` renderer, and
`state/contributions.ts`'s new `endorsementHistoryCounterpartId` resolves
which id is the "other side" of an entry for a given direction.

## Category filter

A "Category" dropdown next to the Range select — **All categories**
(default), **Cards**, **Summaries**, **Highlights**, **Annotations**,
**Original arguments**, or **Refutations** — closes the "per-category
(kind) leaderboards alongside the overall one" follow-up named under the
"Contribution Leaderboard" bullet in `TODO.md`. Switching it re-scopes the
roster to only contributions of that `ContributionKind`:

- `lib/contribution-leaderboard.ts`'s `filterContributionsByKind` narrows
  the (already range-filtered) contribution list to those whose `kind`
  matches the chosen category. `"all"` (the default) returns the list
  unchanged, matching the leaderboard's original unscoped behavior.
- `state/researchProgress.ts`'s `buildPersistedLeaderboardWithCompletedTasks`
  takes a new optional `category` argument (after `range`/`now`), applied
  on top of the range filter. A routed research task has no contribution
  `kind` of its own, so completed-task counts are only folded into the
  roster for the unscoped **All categories** view — picking a specific
  category ranks purely on that category's scored contributions, and a
  contributor with completed tasks but no contribution in that category
  drops off the roster (they still appear under **All categories**).
- The category and range filters compose: e.g. "Cards" + "This week" shows
  only cards submitted in the last 7 days.
- A contributor with no contribution in the chosen category (and, if
  narrower than all-time, window) drops off the roster entirely; switching
  back to **All categories** always restores the full roster.

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
  → buildPersistedLeaderboardWithCompletedTasks() — debate-team-collaboration's state/researchProgress.ts
      (composes lib/contribution-leaderboard.ts's buildLeaderboard with each
       contributor's verified completed-task history)
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
      — debate-research-evidence's lib/session-identity.ts: name, else the
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
store (see `packages/debate-search-evidence/test/contributions.test.ts`), and one
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
`packages/debate-search-evidence/test/live-update.test.ts` (every backing-store
key, the `null`-key clear-all case, and unrelated/substring-matching keys
staying ignored).

## Contributor profile drill-down page

Each row's contributor name links to `/cards/leaderboard/{contributorId}` —
closes the "Contribution Leaderboard" bullet's next-named follow-up in
TODO.md's Research Crowdsourcing Organizer Features section ("a
per-contributor profile drill-down page"). The page renders one
contributor's full cross-feature standing in one place instead of scattering
it across separate panels:

- Leaderboard rank (1-based position on the all-time, all-category board) and
  raw stats (contributions, total/average score, completed tasks).
- Unlock tier and merged tier+streak badges, plus current and longest streak,
  via the same `lib/unlock-streak-status.ts#buildContributorUnlockStatusWithStreakFromStore`
  the leaderboard table itself uses.
- Top Contributor Awards: which categories the contributor currently leads
  (live standings) and their all-time hall-of-fame win record, via
  `lib/contributor-awards.ts#buildContributorAwardsHallOfFame` folded over
  `state/contributorAwardAnnouncements.ts#listAnnouncedContributorAwards`.
- Endorsement history, both received (on the contributor's own
  contributions) and given (as a reviewer), via the existing
  `listEndorsementsByContributor` in both directions.

All of this is assembled by one new composition function,
`lib/contributor-profile.ts#buildContributorProfileFromStore`, rather than
introducing any new scoring/ranking logic or persisted store — it's a
read-only fold over the same five slices `ContributionLeaderboardPanel`
already reads individually. `exists` on the returned `ContributorProfile` is
`false` only when the id has no footprint anywhere (no contribution,
completed task, award, or endorsement); `rank` can still be `null` for an
`exists: true` contributor who has, say, only ever endorsed others or logged
a completed task with no scored contribution.

`panels/ContributorProfilePanel.tsx` renders the profile (a loading state
during SSR/hydration, a "No activity yet" state for an unknown id, and the
full breakdown otherwise), rendered by
`apps/debate-ai.com/app/cards/leaderboard/[contributorId]/page.tsx` through a
`ContributorProfileWithIdentity` wrapper (mirroring
`ContributionLeaderboardWithIdentity`'s "the panel stays app-agnostic, only
this wrapper knows about `better-auth`" convention) that shows a "You" badge
when the profile matches the signed-in visitor. Like the leaderboard table,
it subscribes to the `storage` event via `isContributionLeaderboardLiveUpdateStorageEvent`
so it refreshes when another tab logs new activity.

Vitest-covered in
`packages/debate-contributor-progress/test/contributor-profile.test.ts`: an
unknown contributor returns an all-zero, `exists: false` profile; a ranked
contributor's stats and tier are surfaced; currently-led award categories are
listed; announced awards roll up into a hall-of-fame win count; and
endorsement history (received and given) round-trips correctly, including
the "endorsement-only activity, no scored contribution" case staying
`exists: true` with `rank: null`.

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
- The "My endorsement activity" toggle only appears for a signed-in
  visitor (it has nothing to show an anonymous one, since `direction:
  "given"` is keyed off `signedInContributorId`) and only lists the
  visitor's own activity, not any other contributor's given-endorsement
  history — there's no per-row "given" toggle, only the per-row "received"
  one plus this one signed-in-only "given" view.
