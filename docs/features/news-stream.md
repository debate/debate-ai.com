# News Stream

A single feed for product updates and community announcements, so a debater
doesn't have to separately check the Daily Best Card page, the Contributor
Awards page, and the Tools page's fine print to find out what's new.

- **Route:** `/news`
- **Nav:** the Tools page's Community & Progress group; the Reason Editor's
  Workspace menu (`t news` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-community`](../../packages/debate-contributor-progress/README.md)

## What it shows

Every item, newest first, filterable by category:

- **Product Updates** — hand-maintained posts about shipped features and
  tools (`lib/news-stream.ts`'s `PRODUCT_NEWS`). There's no build step that
  generates these from commits; a feature worth surfacing gets an entry
  added by hand, the same way `feature-catalog.ts`'s `APP_FEATURES` is
  maintained. Every `APP_FEATURES` entry whose route no hand-written
  `PRODUCT_NEWS` item names yet — most of the catalog, since a hand post
  gets written per noteworthy change rather than per tool — additionally
  gets a generic "Tool spotlight: …" post synthesized by
  `lib/news-stream.ts`'s `buildAutoFeatureNews()`, so the feed always
  mentions every tool somewhere even before someone writes a real
  announcement for it. These spotlights all share one timestamp (older than
  every hand-written post) and so always sort below real updates.
- **Daily Best Card** — one item per day announced through
  [`/cards/best-card`](daily-best-card.md), rendered with
  `lib/daily-best-card.ts`'s existing `buildDailyBestCardHighlight`.
- **Contributor Awards** — one item per day announced through
  [`/cards/awards`](contributor-awards.md), rendered with
  `lib/contributor-awards.ts`'s existing `buildAwardsAnnouncementText`.
- **Community** — five categories, none needing a separate "announce" step
  since each is derived straight from its own feature's already-persisted
  history:
  - A [Quest Streaks](quest-streaks.md) milestone, the exact day a
    contributor's streak first reaches it (`dailyMissionResults.ts`'s
    `buildQuestStreakMilestoneEvents`).
  - A [Group Challenge](group-challenges.md) the moment its goal is reached
    (`challengeWinEvents.ts`'s `buildCompletedGroupChallengeEvents`, timed to
    the `targetCount`-th matching contribution or win event).
  - Each UTC day's top [Revision Incentives](revision-incentives.md) earner,
    when at least one revision that day earned a nonzero reward
    (`revisionHistory.ts`'s `buildDailyTopReviserAnnouncements`).
  - A [Team Collaboration Mode](team-collaboration-mode.md) prep note, the
    moment it's logged on a topic sprint at `/cards/collaboration`
    (`sprintNotes.ts`'s `listSprintNotes`, rendered via
    `team-collaboration-mode.ts`'s `buildSprintNoteAnnouncementText`) — the
    first Community source that needs no derivation at all, since a
    `SprintNote` is already the atomic event; capped to the 20 most recent
    notes (see Known gaps).
  - A new [Argument Library](evidence-library.md) submission — a card or
    analytic block — the moment it's saved and live (not held back by an
    in-progress peer review) at `/cards/library`
    (`evidenceLibraryEntries.ts`'s `listEvidenceLibraryEntries`, rendered via
    `shared-evidence-library.ts`'s `buildEvidenceEntryAnnouncementText`) —
    like a prep note, needs no derivation either, since a saved entry is
    already the atomic event, and is likewise capped to the 20 most recent
    entries; only entries saved after this shipped carry
    the `createdAt` timestamp it's sourced from.
  - A new [AI Coach Mode](coaching-sessions.md) session, the moment one is
    generated for a round at `/coaching` — like a prep note or Argument
    Library entry, needs no derivation, since a generated session is
    already the atomic event. Unlike the other five sources, this one isn't
    produced by this package: `debate-round`'s `state/coachingSessions.ts`
    exports its own `coachingSessionNews()` (this package can't depend back
    on `debate-round`, which already depends on this package — see "Data
    flow" below), composed into the feed via `buildNewsFeed`'s `extraItems`
    parameter at the app layer. Only sessions generated after this shipped
    carry the `createdAt` timestamp it's sourced from.
  - A contributor's fully completed [Daily Quests](daily-quests.md) board,
    the day they complete it at `/cards/quests`
    (`dailyMissionResults.ts`'s `buildDailyQuestCompletionEvents`, rendered
    via `gamified-quests.ts`'s `buildDailyQuestCompletionAnnouncementText`)
    — no separate announce step, since "Record today's mission" already
    persists the day's result. Unlike the Quest Streaks milestone source
    above (bounded to rare milestone crossings), a board can be completed
    every day, so this shares the sprint-note/Argument-Library sources'
    `MAX_COMMUNITY_ITEMS_PER_SOURCE` volume cap instead of posting every
    completion unbounded.

Each item can be liked and is marked read on hover; unread items get a
highlighted left border and a "New" badge. Read/like state is a viewer-local
`newsStreamViewerState` localStorage key — it does not feed back into either
source announcement's own data, or into a card's community like count in the
Contributions Feed. For a signed-in user, that local state is additionally
synced to the account's `user_settings` row (`newsRead`/`newsLiked` columns)
via `/api/settings`, so it follows them to another device instead of
resetting to "everything unread" there — see "Account sync" below.

## Data flow

```
lib/news-stream.ts              — NewsItem type, NEWS_CATEGORY_LABELS, PRODUCT_NEWS (hand-maintained),
                                    buildAutoFeatureNews() (reads debate-ui's APP_FEATURES catalog)
state/dailyBestCardAnnouncements.ts    — existing store, read via listAnnouncedDailyBestCards()
state/contributorAwardAnnouncements.ts — existing store, read via listAnnouncedContributorAwards()
state/dailyMissionResults.ts    — existing store, read via buildQuestStreakMilestoneEvents()
                                    and buildDailyQuestCompletionEvents()
state/challengeWinEvents.ts     — existing store, read via buildCompletedGroupChallengeEvents()
state/revisionHistory.ts        — existing store, read via buildDailyTopReviserAnnouncements()
state/sprintNotes.ts            — existing store, read via listSprintNotes()
state/evidenceLibraryEntries.ts — existing store, read via listEvidenceLibraryEntries()
  → state/newsStream.ts         — buildNewsFeed(extraItems?) merges PRODUCT_NEWS,
                                    buildAutoFeatureNews()'s synthesized spotlights, and all
                                    eight in-package stores (mapped to NewsItem via each
                                    store's own highlight/announcement-text helper —
                                    sprintNotes.ts's via team-collaboration-mode.ts's
                                    buildSprintNoteAnnouncementText, evidenceLibraryEntries.ts's
                                    via shared-evidence-library.ts's buildEvidenceEntryAnnouncementText,
                                    dailyMissionResults.ts's completion events via
                                    gamified-quests.ts's buildDailyQuestCompletionAnnouncementText)
                                    plus any caller-supplied extraItems, sorted newest first
                                  — isNewsItemRead/markNewsItemRead/isNewsItemLiked/
                                    toggleNewsItemLiked (localStorage, "newsStreamViewerState")
  → panels/NewsStreamPanel.tsx  — category filter tabs, per-item read/like UI,
                                    cross-tab live update; threads an optional extraItems
                                    prop straight into buildNewsFeed(), and an optional
                                    syncRemote adapter (hydrate/pushRead/pushLiked) around
                                    mergeRemoteViewerState()/listReadIds()/listLikedIds()

(a package boundary this diagram can't show in one straight line:)
debate-round's state/coachingSessions.ts — its own store, read via coachingSessionNews()
                                            (debate-round already depends on debate-research-evidence,
                                            so it can't be a source *inside* newsStream.ts above
                                            without a cycle — it produces NewsItems itself instead)
  → apps/debate-ai.com/app/news/NewsPageContent.tsx — the one place that depends on both
                                    packages; calls coachingSessionNews() and passes the
                                    result as NewsStreamPanel's extraItems prop, plus
                                    useNewsStreamSync() as its syncRemote prop

lib/news-stream-sync.ts         — NewsSyncPayload type, normalizeNewsSyncPatch/
                                    serializeNewsIdList/parseNewsIdList (same
                                    package-boundary split as state/favoriteTools.ts:
                                    validation here, localStorage read/write in
                                    state/newsStream.ts)
  → apps/debate-ai.com/app/api/settings/route.ts — GET/PUT the user_settings row's
                                    news_read/news_liked columns alongside every other
                                    account-linked preference field
  → apps/debate-ai.com/lib/hooks/useNewsStreamSync.ts — fetchUserSettings()/
                                    saveUserSettings() (debate-round's client, shared
                                    with UserSettingsPanel/useFavoriteTools) wrapped as
                                    a NewsStreamSyncAdapter
  → apps/debate-ai.com/app/news/NewsPageContent.tsx — wires the hook into
                                    NewsStreamPanel's syncRemote prop
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
`challengeWinEvents.ts`, `revisionHistory.ts`, `sprintNotes.ts`, and
`evidenceLibraryEntries.ts` already persist into the feed's common
`NewsItem` type — nor does `debate-round`'s `coachingSessionNews()`, which
re-shapes `state/coachingSessions.ts`'s own persisted records the same way.
The Daily Best Card and Contributor Awards categories need an explicit
"announce" action in their own panel; the six Community categories added
afterward (quest streak milestones, group challenge completions, Revision
Incentives standings, Team Collaboration Mode prep notes, Argument Library
submissions, AI Coach Mode sessions) don't — each is derived fresh every
time straight from its source feature's own history (mission results,
challenge contributions/win events, revision records, logged sprint notes,
saved evidence-library entries, generated coaching sessions), so completing
a mission, winning a challenge, revising a card, logging a prep note,
submitting a card/block, or generating a coaching session (from those
features' own panels) is what makes it appear here, with no separate
"announce" step and no risk of re-reporting the same event on a later day.
The prep-note, Argument Library, and coaching-session sources need no
derivation at all over that history — every streak/challenge/revision
Community source computes an event from a longer record (a streak crossing
a milestone, a challenge's Nth contribution, a day's top reviser), but a
logged `SprintNote`, saved `EvidenceLibraryEntry`, or generated
`CoachingSessionRecord` already *is* the event, so `sprintNoteNews()`,
`argumentLibraryNews()`, and `coachingSessionNews()` just map
`listSprintNotes()`/`listEvidenceLibraryEntries()`/`listCoachingSessions()`
straight to `NewsItem`s (the latter two filtered to entries/sessions that
carry a `createdAt`, stamped on first submission/generation by
`EvidenceLibraryPanel.tsx`'s `handleSubmit` and
`CoachingSessionsPanel.tsx`'s `buildAndSaveCoachingSession` call
respectively).

## Account sync

Closes the "Read/like state is per-browser" Known gap this doc used to
record: local-first, matching every other account-linked preference in this
repo (`UserSettingsPanel`, `useFavoriteTools`, `useThemeState`) —
`NewsStreamPanel`'s own `localStorage` viewer state stays the source of
truth for the current browser, whether signed in or not, and account sync
is a best-effort layer on top rather than a replacement for it.

- **On mount**, `NewsPageContent.tsx` passes `useNewsStreamSync()`'s
  `hydrate` function as `syncRemote.hydrate`. The panel calls it once; a
  signed-in user's saved `newsRead`/`newsLiked` id lists (from
  `GET /api/settings`) are merged into local state via
  `mergeRemoteViewerState` — a **union**, not a replacement: an id already
  read/liked in this browser stays that way even if the account row hasn't
  caught up yet, and vice versa. A signed-out user, or a failed fetch, gets
  `null` back and the panel behaves exactly as it did before this prop
  existed.
- **On each new read/like**, the panel calls `syncRemote.pushRead`/
  `pushLiked` with the *full* current local id list (`listReadIds()`/
  `listLikedIds()`), which `useNewsStreamSync` PUTs to `/api/settings` —
  the same "resend the whole list" shape `favoriteTools` already uses, not
  a diff. Fire-and-forget: a failed push is swallowed, matching
  `useFavoriteTools`'s "local apply is never blocked by a sync failure"
  convention, so a flaky connection never blocks marking something read.
- Validated server-side by `normalizeNewsSyncPatch`
  (`lib/news-stream-sync.ts`): each field is a JSON array of up to
  `MAX_NEWS_SYNC_ITEMS` (500) unique, non-empty, printable-ASCII ids —
  generous but bounded, the same posture `MAX_FAVORITE_TOOLS` uses,
  against a buggy or malicious client growing the row without limit.

## Known gaps

- The auto-generated "Tool spotlight" post is a generic, one-line
  restatement of `feature-catalog.ts`'s own description — it can't tell a
  brand-new tool from one that's simply never been individually announced,
  so it doesn't distinguish "just shipped" from "always been here." Writing
  a real `PRODUCT_NEWS` entry for a tool remains the way to say something
  more specific than that.
- Because the read/like account sync above is a union merge rather than a
  full two-way sync, **unliking** an item on one device doesn't clear that
  like on another device until that other device's own next toggle
  overwrites the account row with its own (now-different) current list —
  an accepted tradeoff for keeping the merge simple and never
  destructively clobbering a browser's local state on hydration. Marking
  something read has no equivalent "unread" action, so this asymmetry
  doesn't apply there.
- Every `pushRead`/`pushLiked` call resends the *entire* current id list,
  not a diff — fine at today's feed size (bounded by `PRODUCT_NEWS` plus
  each community source's own `MAX_COMMUNITY_ITEMS_PER_SOURCE` cap) but a
  PUT payload that grows linearly with how much of the feed a heavy user
  has read over time, same tradeoff `favoriteTools` already accepts at a
  smaller scale.
- Sprint notes and Argument Library entries are capped to the 20 most
  recent (by `createdAt`) each — `state/newsStream.ts`'s
  `MAX_COMMUNITY_ITEMS_PER_SOURCE` — so a very active topic sprint or a
  busy submission period can no longer flood the whole feed. This is a
  feed-projection cap only (nothing is deleted from `sprintNotes.ts`/
  `evidenceLibraryEntries.ts`, and both tools' own pages still list every
  record); a sprint or submission period busier than 20 items still pushes
  its own older items out of the feed before a viewer necessarily sees
  them, and the cap is per source rather than per topic/contributor, so
  one very active topic can crowd out a quieter one's notes entirely.
- An `EvidenceLibraryEntry` saved before the `createdAt` field existed has
  none, so it never appears here — only entries saved after this shipped
  are backfilled; there's no migration that stamps one onto pre-existing
  localStorage records.
