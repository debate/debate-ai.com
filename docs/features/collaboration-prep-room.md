# Collaboration Prep Room

A topic's shared prep space: a switcher for every topic with either a
tracked-argument checklist or submitted evidence, a keyword search over that
topic's evidence and team-drafted draft blocks, and the topic's coverage-gap
research tasks routed to available contributors.

- **Route:** `/cards/prep-room`
- **Nav:** the Tools page's Community & Progress group; the Reason Editor's
  Workspace menu (`t prep room` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

| Element | Source |
| --- | --- |
| Topic switcher | `listPrepRoomTopics()` — every topic with a checklist entry or a submitted evidence entry |
| Summary line | `buildPrepRoomSummaryText` — evidence-library, draft-block, and routing summary lines |
| Evidence/draft-block search | `searchPrepRoomEvidence`, scoped to the room's topic only |
| Routed research tasks | The room's `routing.assignments`/`unassignedTasks`, from `buildRoutingResult` |
| Active-now roster | `listPersistedActiveContributors(topic, now)` — teammates with a fresh heartbeat for this topic |
| Room activity timeline | `buildPrepRoomActivityTimeline(room)` — the room's dated entries, newest first |

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
  → buildPrepRoomActivityTimeline(room)       — lib/prep-room.ts (pure)
  → panels/PrepRoomPanel.tsx (renders the switcher + search + routed tasks + activity timeline)
  → apps/debate-ai.com/app/cards/prep-room/page.tsx (mounts the panel as a route)

Presence ("active now"):
state/topicPresence.ts (localStorage: topicPresenceHeartbeats)
  → listPersistedActiveContributors(topic, now)  — polled on topic switch and every 30s
  → panels/PrepRoomPanel.tsx                     — renders the open topic's fresh roster

Marking yourself active:
panels/PrepRoomPanel.tsx ("I'm active here" button, next to a "Your ID" field)
  → recordPersistedPresenceHeartbeat(topic, myId, now)  — state/topicPresence.ts
  → panel re-reads listPersistedActiveContributors(topic, now) to refresh

Signed-in identity prefill ("Your ID"):
apps/debate-ai.com/components/research/PrepRoomWithIdentity.tsx
  → deriveContributorIdFromSessionIdentity(user)  — debate-card-search
  → panels/PrepRoomPanel.tsx's signedInContributorId prop (seeds "Your ID"
    only if the visitor hasn't typed over it)
```

`lib/prep-room.ts`'s `buildPrepRoom`/`buildPrepRoomFromStore` already existed
(the latter resolving `entries` from the persisted evidence library), but
still required a caller to supply a `coverageReport` and `contributors` list
directly — there was no panel UI. This feature adds `state/prepRooms.ts`,
which resolves those two remaining inputs from their own already-persisted
stores so a caller only needs a topic name, and `panels/PrepRoomPanel.tsx`,
which renders the result. See
`packages/debate-card-search/test/prepRooms.test.ts`.

This also closes follow-up (b), "a live presence/who's-active signal,"
reusing `lib/topic-presence.ts`/`state/topicPresence.ts` unchanged — the same
heartbeat-based presence primitive added for the "🤝 Team Collaboration Mode"
bullet's own identical follow-up (TODO.md notes the two as the same signal).
A contributor enters a "Your ID" and clicks "I'm active here" to record a
heartbeat for the open topic; the roster shows every contributor with a
heartbeat inside the default 5-minute freshness window, most-recently-active
first, and re-checks staleness every 30 seconds even without a new
heartbeat. See `docs/features/team-collaboration-mode.md` for the underlying
model and its Vitest coverage. No follow-ups remain open on this bullet.

In the Research hub (`ResearchHub.tsx`), the Prep Room tab renders
`PrepRoomWithIdentity` instead of the raw panel, prefilling "Your ID" from
`deriveContributorIdFromSessionIdentity` for a signed-in visitor — the same
prefill-only convention used by `ReviewQueuePanel`/`GroupChallengesPanel`
and the rest of the identity-wiring series (PRs #318-#323). The standalone
`/cards/prep-room` route still mounts the raw `PrepRoomPanel` (no
`signedInContributorId`), so "Your ID" stays blank there regardless of
sign-in state.

## Room activity timeline

A "Room activity timeline" section renders below the routed-tasks list,
backed by `lib/prep-room.ts`'s `buildPrepRoomActivityTimeline(room)`. The
only genuinely timestamped, append-only signal a prep room already has is
each evidence/draft-block entry's own `createdAt` — the same field
`state/newsStream.ts`'s `argumentLibraryNews()` already reads, stamped once
by `EvidenceLibraryPanel.tsx`'s submit handler. Routed task assignments are
recomputed live from the current coverage report and contributor roster
rather than logged as discrete events, and presence heartbeats are an
upsert of each contributor's *latest* sighting rather than a history, so
neither makes a real "N happened at time T" timeline entry — the timeline
is the room's dated entries only, newest-`createdAt` first, capped to 30
(`DEFAULT_PREP_ROOM_ACTIVITY_LIMIT`). Each row shows a localized date/time
plus a short line from `buildPrepRoomActivityEventText` (e.g. "Evidence
added: States CP (Smith 24)" or "Draft block filed: States CP"). An entry
persisted before `createdAt` existed has no real submission time to show
and is silently dropped rather than sorted arbitrarily. See
`packages/debate-team-collaboration/test/prep-room.test.ts`.

## Known gaps

- The room is per-browser localStorage, not a shared team resource — two
  teammates on different devices see different rooms for the same topic
  name (this also means presence heartbeats are per-browser, not truly
  cross-device shared).
- No reviewer-identity/permission checks (this repo's auth system only
  identifies a signed-in visitor for prefill purposes — see "Your ID"
  above — there is still no server-side gate on prep-room actions).
- The `/cards/prep-room` standalone route doesn't get the "Your ID"
  prefill (only the Research hub's Prep Room tab does).
- The activity timeline only covers evidence/draft-block submissions —
  there's still no "shared task checklist view" or "shared file/attachment
  area" (the other two follow-ups named alongside it).
