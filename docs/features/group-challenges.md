# Group Challenges

Lets a coach create a squad-scoped friendly challenge — either "reach N
matching contributions" or "reach N recorded wins," with a roster and a
challenge window — and shows every persisted `GroupChallenge`'s live
standings, derived from the real, persisted contribution feed and win-event
list.

- **Route:** `/cards/group-challenges`
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

Each persisted `GroupChallenge` renders as its own card: title, goal
description, challenge window, and roster. Below that, its live
`GroupChallengeProgress` (via `state/challengeWinEvents.ts`'s
`buildPersistedGroupChallengeBoard`) shows a one-line status
(`buildGroupChallengeSummaryText` — complete, ended, or `N/target — D days
left`) and a per-member standings list, best first, with 🏆 marking the
current MVP.

A `win_target` challenge additionally gets a "Record a win" action —
a contributor ID field and button that appends a `ChallengeWinEvent`.

## Data flow

```
state/groupChallenges.ts (localStorage: groupChallenges)
  → buildGroupChallengesPanelView()          — every persisted GroupChallenge,
                                                title-sorted

state/challengeWinEvents.ts (localStorage: challengeWinEvents)
  → buildPersistedGroupChallengeBoard(now)   — composes the persisted
                                                challenge roster, the real
                                                persisted contribution feed
                                                (state/contributions.ts,
                                                filtered to entries carrying
                                                submittedAt), and this
                                                store's persisted win events
                                                via group-challenges.ts's
                                                buildGroupChallengeBoard

  → panels/GroupChallengesPanel.tsx  — renders each challenge's config
                                        alongside its live standings

Recording a win:
panels/GroupChallengesPanel.tsx
  → recordChallengeWinEvent(contributorId, now)  — state/challengeWinEvents.ts
  → panel re-reads buildPersistedGroupChallengeBoard() to refresh
```

A `ChallengeWinEvent` isn't itself scoped to one challenge — it's a flat,
squad-wide event list. `computeGroupChallengeProgress` matches an event
against any `win_target` challenge whose roster and window contain it, the
same way a `contribution_target` challenge matches against the shared
contribution feed rather than a per-challenge one.

A later slice adds a signed-in prefill (mirroring [Task Inbox](./task-inbox.md)'s
identical convention) for each challenge's "Record a win (contributor ID)"
field:

```
components/research/GroupChallengesWithIdentity.tsx  — "use client" wrapper
  → useSession()                          — lib/hooks/useSession.ts, the
                                              better-auth React session hook
  → deriveContributorIdFromSessionIdentity(user)
      — debate-card-search's lib/session-identity.ts: name, else the
        email's local part, else the raw account id, else ""
  → <GroupChallengesPanel signedInContributorId={...} />
      — seeds each challenge's own "Record a win" field until that
        challenge's field is first touched, after which that challenge's
        typed value always wins; recording a win still clears that
        challenge's field back to blank afterward, same as before
```

`apps/debate-ai.com/app/cards/group-challenges/page.tsx` and
`ResearchHub.tsx`'s Quests tab now mount this wrapper instead of the bare
panel; a signed-out visitor sees the exact same blank fields as before.

## Cross-tab live update

`GroupChallengesPanel` now also subscribes to the browser's `storage`
event, which fires only in *other* same-origin tabs/windows, never the one
that made the write — closing the "Every other localStorage-backed panel
in this repo still has no cross-tab live-update mechanism" Known gap noted
in [`shared-flow-sync.md`](shared-flow-sync.md), for this panel. A new
pure helper, `state/live-update.ts`'s `isGroupChallengesLiveUpdateStorageEvent`,
checks whether the event's `key` is one of this panel's three backing
stores (`groupChallenges`, `challengeWinEvents`, or `contributions`), or
`null` for a `localStorage.clear()`; when it is, the listener calls the
panel's existing `refresh()` (both `buildGroupChallengesPanelView()` and
`buildPersistedGroupChallengeBoard()`), so a challenge created or removed,
a win recorded, or a matching contribution submitted in another tab shows
up here without a manual reload. Vitest-covered in
`packages/debate-card-search/test/live-update.test.ts` (every backing-key
match, the `null`-key clear-all case, and unrelated/substring-matching keys
staying ignored).

## News Stream integration

A challenge's completion — its goal's `targetCount`-th matching contribution
or win event landing — posts to the News Stream feed automatically, no
separate notification path needed: `group-challenges.ts`'s
`computeChallengeCompletionTimestamp` derives the exact moment (purely from
the same contributions/win-events every other computation here already
reads, so no separate "completed at" field is persisted), `state/
challengeWinEvents.ts`'s `buildCompletedGroupChallengeEvents` turns every
completed challenge into a `CompletedGroupChallengeEvent`, and `debate-
community`'s `state/newsStream.ts#groupChallengeNews` renders each as a
`community`-category `NewsItem` linking back to `/cards/group-challenges`.
See [`news-stream.md`](./news-stream.md)'s Group Challenges source for the
full pipeline. This was raised again as a "digest notification summarizing
challenge results" follow-up under idea #13 ("Coaching Programs and Group
Challenges") in `TODO.md`, but is already fully covered by this existing
News Stream item — no further work needed there.

## Known gaps

- "Record a win (contributor ID)" is still free-form text, not a login — a
  real signed-in session only *prefills* it (see "Signed-in prefill"
  above), so a visitor can still overwrite it to record a win under any
  id. There is no server-side session check on `recordChallengeWinEvent`,
  the same trust boundary every other localStorage-backed action in this
  repo has.

The "(b-continued)" follow-up under idea #13 ("Coaching Programs and Group
Challenges") in `TODO.md` this bullet used to point to is closed:
`debate-round`'s `state/persistedCoachingProgramBoard.ts` reads this store
via `listGroupChallenges` (composed with the topic-sprint, contribution, and
win-event stores into a full `CoachingProgramBoard`), and
`panels/CoachingProgramsPanel.tsx` renders it through
`buildPersistedCoachingProgramBoard`. See
[`coaching-programs.md`](coaching-programs.md) for the full data flow.
