# News Stream

A single feed for product updates and community announcements, so a debater
doesn't have to separately check the Daily Best Card page, the Contributor
Awards page, and the Tools page's fine print to find out what's new.

- **Route:** `/news`
- **Nav:** the Tools page's Community & Progress group; the Reason Editor's
  Workspace menu (`t news` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

Every item, newest first, filterable by category:

- **Product Updates** — hand-maintained posts about shipped features and
  tools (`lib/news-stream.ts`'s `PRODUCT_NEWS`). There's no build step that
  generates these from commits; a feature worth surfacing gets an entry
  added by hand, the same way `feature-catalog.ts`'s `APP_FEATURES` is
  maintained.
- **Daily Best Card** — one item per day announced through
  [`/cards/best-card`](daily-best-card.md), rendered with
  `lib/daily-best-card.ts`'s existing `buildDailyBestCardHighlight`.
- **Contributor Awards** — one item per day announced through
  [`/cards/awards`](contributor-awards.md), rendered with
  `lib/contributor-awards.ts`'s existing `buildAwardsAnnouncementText`.
- **Community** — three more categories, none needing a separate
  "announce" step since each is derived straight from its own feature's
  already-persisted history:
  - A [Quest Streaks](quest-streaks.md) milestone, the exact day a
    contributor's streak first reaches it (`dailyMissionResults.ts`'s
    `buildQuestStreakMilestoneEvents`).
  - A [Group Challenge](group-challenges.md) the moment its goal is reached
    (`challengeWinEvents.ts`'s `buildCompletedGroupChallengeEvents`, timed to
    the `targetCount`-th matching contribution or win event).
  - Each UTC day's top [Revision Incentives](revision-incentives.md) earner,
    when at least one revision that day earned a nonzero reward
    (`revisionHistory.ts`'s `buildDailyTopReviserAnnouncements`).

Each item can be liked and is marked read on hover; unread items get a
highlighted left border and a "New" badge. Read/like state is a viewer-local
`newsStreamViewerState` localStorage key — it does not feed back into either
source announcement's own data, or into a card's community like count in the
Contributions Feed.

## Data flow

```
lib/news-stream.ts              — NewsItem type, NEWS_CATEGORY_LABELS, PRODUCT_NEWS (hand-maintained)
state/dailyBestCardAnnouncements.ts    — existing store, read via listAnnouncedDailyBestCards()
state/contributorAwardAnnouncements.ts — existing store, read via listAnnouncedContributorAwards()
state/dailyMissionResults.ts    — existing store, read via buildQuestStreakMilestoneEvents()
state/challengeWinEvents.ts     — existing store, read via buildCompletedGroupChallengeEvents()
state/revisionHistory.ts        — existing store, read via buildDailyTopReviserAnnouncements()
  → state/newsStream.ts         — buildNewsFeed() merges PRODUCT_NEWS with all five stores
                                    (mapped to NewsItem via each store's own highlight/
                                    announcement-text helper), sorted newest first
                                  — isNewsItemRead/markNewsItemRead/isNewsItemLiked/
                                    toggleNewsItemLiked (localStorage, "newsStreamViewerState")
  → panels/NewsStreamPanel.tsx  — category filter tabs, per-item read/like UI,
                                    cross-tab live update
  → apps/debate-ai.com/app/news/page.tsx — mounts the panel as a route
```

## Cross-tab live update

`NewsStreamPanel` subscribes to the browser's `storage` event (fires only in
*other* same-origin tabs/windows, never the one that made the write) via
`state/live-update.ts`'s `isNewsStreamLiveUpdateStorageEvent` — mirroring the
mechanism already used by
[Daily Best Card](daily-best-card.md)/[Contributor Awards](contributor-awards.md)
and the other panels listed in
[`shared-flow-sync.md`](shared-flow-sync.md). It rebuilds the feed and
re-derives read/liked state whenever another tab announces a Daily Best Card
or Contributor Awards winner, or toggles read/like state on a news item
(`"dailyBestCardAnnouncements"`, `"contributorAwardAnnouncements"`,
`"newsStreamViewerState"`), so a second tab no longer needs a manual reload
to see it.

`state/newsStream.ts` introduces no new persisted event data of its own —
it only re-shapes what `dailyBestCardAnnouncements.ts`,
`contributorAwardAnnouncements.ts`, `dailyMissionResults.ts`,
`challengeWinEvents.ts`, and `revisionHistory.ts` already persist into the
feed's common `NewsItem` type. The Daily Best Card and Contributor Awards
categories need an explicit "announce" action in their own panel; the three
Community categories added afterward (quest streak milestones, group
challenge completions, Revision Incentives standings) don't — each is
derived fresh every time straight from its source feature's own history
(mission results, challenge contributions/win events, revision records), so
completing a mission, winning a challenge, or revising a card (from those
features' own panels) is what makes it appear here, with no separate
"announce" step and no risk of re-reporting the same event on a later day.

## Known gaps

- Product Updates are manually curated — nothing detects a newly added
  route or `feature-catalog.ts` entry and drafts a post for it.
- Read/like state is per-browser (localStorage), not per-account — signing
  in on a different device shows every item as unread again.
- The Community categories only cover events this package can already
  detect from persisted history (streak milestones, challenge completions,
  daily top reviser) — other community moments (a new Argument Library
  entry, a Prep Room note, a coaching session) still aren't wired in.
