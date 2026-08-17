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

## Known gaps

- This panel only renders the `SprintNote` thread itself, not the full
  `buildTopicSprint` composition (quest board + task routing + progress
  board alongside notes) — none of `TopicCoverageReport`,
  `ContributorAvailability`, `TrackedTopicAssignment`, or `QuestContribution`
  are persisted in a form this panel could read live yet. That's follow-up
  (b), "persisting a topic sprint's other inputs," and remains open.
- No live presence/who's-active signal (follow-up (c)) — not attempted.
