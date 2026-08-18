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

## Known gaps

- This panel only renders the `SprintNote` thread itself, not the full
  `buildTopicSprint` composition (quest board + task routing + progress
  board alongside notes) — none of `TopicCoverageReport`,
  `ContributorAvailability`, `TrackedTopicAssignment`, or `QuestContribution`
  are persisted in a form this panel could read live yet. That's follow-up
  (b), "persisting a topic sprint's other inputs," and remains open.
