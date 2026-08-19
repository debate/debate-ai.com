# Team Collaboration Mode

Lets a teammate leave a live prep note against a shared topic sprint, and
shows every persisted `SprintNote` grouped by topic, with a "cycle status"
action and an "assign to" control per note — mirroring `debate-round`'s
Prep Notes panel, since `SprintNoteStatus` shares the same open/covered/
needs-follow-up cycle as `PrepNoteStatus`.

- **Route:** `/cards/collaboration`
- **Nav:** the global dock's Settings menu → **Team Collaboration Mode**
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

A form to add a note (topic, author ID, note text, optional assignee), then
every persisted note grouped into its topic, each group in first-seen order
across the stored notes and each topic's notes oldest first. Each note shows
its status badge, text, author, current assignee (if any), a "Mark &lt;next
status&gt;" button, and an "Assign to" input + button (plus an "Unassign"
button once a note is assigned).

| Status | Meaning |
| --- | --- |
| Open | The note hasn't been marked covered or flagged for follow-up |
| Covered | The topic this note is about has been addressed |
| Needs follow-up | The topic this note is about still needs work |

## Data flow

```
state/sprintNotes.ts (localStorage: sprintNotes)
  → buildSprintNotesPanelView()                — groups every persisted
                                                   SprintNote by topic,
                                                   each group oldest first
  → panels/SprintNotesPanel.tsx                — renders the form + grouped list
  → apps/debate-ai.com/app/cards/collaboration/page.tsx  — mounts the panel as a route

Adding a note:
panels/SprintNotesPanel.tsx
  → saveSprintNote(note)                       — state/sprintNotes.ts
  → panel re-reads buildSprintNotesPanelView() to refresh

Cycling a note's status:
panels/SprintNotesPanel.tsx
  → nextSprintNoteStatus(status)                       — state/sprintNotes.ts
      (open → covered → needs-follow-up → open)
  → updatePersistedSprintNoteStatus(id, next, now)      — state/sprintNotes.ts
      (applies lib/team-collaboration-mode.ts's updateSprintNoteStatus and saves it)
  → panel re-reads buildSprintNotesPanelView() to refresh

Assigning/unassigning a note:
panels/SprintNotesPanel.tsx
  → assignPersistedSprintNote(id, assignedToId | null, now)  — state/sprintNotes.ts
      (applies lib/team-collaboration-mode.ts's assignSprintNote and saves it)
  → panel re-reads buildSprintNotesPanelView() to refresh

Presence ("active now"):
state/topicPresence.ts (localStorage: topicPresenceHeartbeats)
  → listPersistedActiveContributors(topic, now)  — every topic group polls this
                                                     on mount and every 30s
  → panels/SprintNotesPanel.tsx                  — renders each topic's fresh
                                                     roster as badges

Marking yourself active:
panels/SprintNotesPanel.tsx ("I'm active here" button, per topic group)
  → recordPersistedPresenceHeartbeat(topic, myId, now)  — state/topicPresence.ts
      (applies lib/topic-presence.ts's recordPresenceHeartbeat upsert and saves it)
  → panel re-reads listPersistedActiveContributors(topic, now) to refresh
```

This closes follow-up (a), "a collaboration-mode panel UI," named under the
"🤝 Team Collaboration Mode" bullet in `TODO.md`, adding four small helpers to
`state/sprintNotes.ts` — `buildSprintNotesPanelView` (groups the persisted
notes by topic for the panel), `nextSprintNoteStatus` (the panel's
status-cycle order), and `updatePersistedSprintNoteStatus`/
`assignPersistedSprintNote` (apply-and-save the already-existing
`updateSprintNoteStatus`/`assignSprintNote` pure transitions) — rather than
introducing new note-lifecycle logic. Vitest-covered in
`packages/debate-card-search/test/sprintNotes.test.ts`.

A later slice closes follow-up (c), "a presence/live-status signal for who's
currently active." There's no WebSocket (or similar) live transport
anywhere in this repo, so presence is modeled as an explicit,
caller-recorded heartbeat rather than a push signal: `lib/topic-presence.ts`
adds a `PresenceHeartbeat` model (one heartbeat per topic + contributor
pair, upserted by `recordPresenceHeartbeat`) and `listActiveContributors`,
which treats a contributor as active only while their most recent heartbeat
for that topic is within a freshness window (5 minutes by default). Its
`state/topicPresence.ts` persists heartbeats to localStorage under
`topicPresenceHeartbeats`, mirroring the `sprintNotes.ts` persistence
convention. `SprintNotesPanel.tsx` renders each topic group's live "active
now" roster (badges, most-recently-active first, or "No one active right
now.") and gives a contributor a "Your ID" field plus an "I'm active here"
button per topic to record their own heartbeat; every topic's roster
re-evaluates staleness on a 30-second client-side timer even without a new
heartbeat, so someone who goes quiet drops off the list. Vitest-covered in
`packages/debate-card-search/test/topic-presence.test.ts` (the pure
heartbeat/freshness logic) and `test/topicPresence.test.ts` (the persisted
store). No follow-ups remain open on this bullet.

A later slice closes follow-up (b), "persisting a topic sprint's other
inputs (so the full `buildTopicSprint` composition can be rendered, not just
the note thread)." `SprintNotesPanel` above still only renders the note
thread — the full composition lives in a separate, already-existing
`panels/TopicSprintPanel.tsx` (quest board, task routing, progress board,
and notes in one view), which previously required its caller to hand-supply
`quests`/`contributions`/`coverageReport`/`assignments` (only `contributors`
and `notes` already defaulted to persisted state). `state/topicSprints.ts`
adds `readPersistedTopicSprintInputs`/`buildPersistedTopicSprint`, composing
every one of those six inputs from its own already-persisted store —
`state/dailyQuests.ts` (quest templates), `state/contributions.ts`
(timestamped contributions), `state/trackedArguments.ts`'s
`buildPersistedTopicCoverageReport` (the topic's live coverage report),
`state/contributorAvailability.ts`, a new `state/researchProgress.ts`
`listTrackedAssignmentsForTopic` (this topic's completed-plus-still-active
assignments, scoped down from the same completed-task history and routed
queues `buildPersistedResearchProgressBoard` already reads across every
topic), and `state/sprintNotes.ts` — rather than requiring a caller to
assemble them, mirroring `state/prepRooms.ts`'s `buildPersistedPrepRoom`
"compose every input from its own store" convention. `TopicSprintPanel` now
makes those four props optional, re-reading `readPersistedTopicSprintInputs`
whenever its `topic` prop changes and falling back to it for any prop the
caller doesn't override; `ResearchHub.tsx`'s Sprint tab (the panel's only
current caller) now just passes a `topic`, having previously hand-derived a
coverage report from the evidence library and always passed `contributions:
[]`. Vitest-covered in `packages/debate-card-search/test/topicSprints.test.ts`
(each input read individually, plus an end-to-end composed sprint) and a new
`listTrackedAssignmentsForTopic` describe block in `test/researchProgress.test.ts`.
`sprint.routing` itself is unchanged: it's still a *live* re-route of the
topic's current coverage gaps against current contributor availability
(`buildRoutingResult`), not a readback of whatever was last routed and saved
to `routedTaskQueues.ts` — only `sprint.progressBoard` reads the persisted
routed/completed assignments. No follow-ups remain open on this bullet.

## Known gaps

- None — see the note above.
