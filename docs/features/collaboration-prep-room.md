# Collaboration Prep Room

A topic's shared prep space: a switcher for every topic with either a
tracked-argument checklist or submitted evidence, a keyword search over that
topic's evidence and team-drafted draft blocks, and the topic's coverage-gap
research tasks routed to available contributors.

- **Route:** `/cards/prep-room`
- **Nav:** the global dock's Settings menu → **Collaboration Prep Room**
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

| Element | Source |
| --- | --- |
| Topic switcher | `listPrepRoomTopics()` — every topic with a checklist entry or a submitted evidence entry |
| Summary line | `buildPrepRoomSummaryText` — evidence-library, draft-block, and routing summary lines |
| Evidence/draft-block search | `searchPrepRoomEvidence`, scoped to the room's topic only |
| Routed research tasks | The room's `routing.assignments`/`unassignedTasks`, from `buildRoutingResult` |

## Data flow

```
state/evidenceLibraryEntries.ts (localStorage — submitted cards/blocks)
state/trackedArguments.ts (localStorage — topic checklist)
state/contributorAvailability.ts (localStorage — contributor profiles)
  → buildPersistedPrepRoom(topic)                — state/prepRooms.ts
      → buildPersistedTopicCoverageReport(topic)  — state/trackedArguments.ts
      → listContributorAvailability()             — state/contributorAvailability.ts
      → buildPrepRoomFromStore()                  — lib/prep-room.ts
          → buildPrepRoom()                       — lib/prep-room.ts (pure)
  → panels/PrepRoomPanel.tsx (renders the switcher + search + routed tasks)
  → apps/debate-ai.com/app/cards/prep-room/page.tsx (mounts the panel as a route)
```

`lib/prep-room.ts`'s `buildPrepRoom`/`buildPrepRoomFromStore` already existed
(the latter resolving `entries` from the persisted evidence library), but
still required a caller to supply a `coverageReport` and `contributors` list
directly — there was no panel UI. This feature adds `state/prepRooms.ts`,
which resolves those two remaining inputs from their own already-persisted
stores so a caller only needs a topic name, and `panels/PrepRoomPanel.tsx`,
which renders the result. See
`packages/debate-card-search/test/prepRooms.test.ts`.

## Known gaps

- The room is per-browser localStorage, not a shared team resource — two
  teammates on different devices see different rooms for the same topic
  name.
- No live presence/who's-active signal (the "(b) a live presence/who's-active
  signal" follow-up named in TODO.md remains open).
- No reviewer-identity/permission checks (no auth/roles in this repo yet).
