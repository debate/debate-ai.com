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

## Known gaps

None open — the "(b-continued)" follow-up under idea #13 ("Coaching
Programs and Group Challenges") in `TODO.md` this bullet used to point to
is closed: `debate-round`'s `state/persistedCoachingProgramBoard.ts` reads
this store via `listGroupChallenges` (composed with the topic-sprint,
contribution, and win-event stores into a full `CoachingProgramBoard`), and
`panels/CoachingProgramsPanel.tsx` renders it through
`buildPersistedCoachingProgramBoard`. See
[`coaching-programs.md`](coaching-programs.md) for the full data flow.
