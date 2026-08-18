# Prep Notes

Shows every persisted "Strategy Sync Notes" `PrepNote` across every flow,
grouped by status (notes needing follow-up first), with a "cycle status"
action per note and an "assign to" control for handing a note off as a task
to a teammate.

- **Route:** `/prep-notes`
- **Nav:** the global dock's Settings menu → **Prep Notes**
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

Notes are grouped into three sections, in this order:

| Group | Meaning |
| --- | --- |
| Needs follow-up | The argument this note is about still needs work |
| Open | The note hasn't been marked covered or flagged for follow-up |
| Covered | The argument this note is about has been addressed |

Each note shows its text, author, current assignee (if any), a "Mark
&lt;next status&gt;" button, and an "Assign to" input + button (plus an
"Unassign" button once a note is assigned).

## Data flow

```
state/prepNotes.ts (localStorage: prepNotes)
  → buildPrepNotesPanelView()             — groups every persisted PrepNote
                                             by status, needs-follow-up
                                             first, each group oldest first
  → panels/PrepNotesPanel.tsx             — renders it, grouped by status
  → apps/debate-ai.com/app/prep-notes/page.tsx  — mounts the panel as a route

Cycling a note's status:
panels/PrepNotesPanel.tsx
  → nextPrepNoteStatus(status)                    — state/prepNotes.ts
      (open → covered → needs-follow-up → open)
  → updatePersistedPrepNoteStatus(id, next, now)   — state/prepNotes.ts
      (applies flow/strategy-sync-notes.ts's updateNoteStatus and saves it)
  → panel re-reads buildPrepNotesPanelView() to refresh

Assigning/unassigning a note:
panels/PrepNotesPanel.tsx
  → assignPersistedPrepNote(id, assignedToId | null, now)  — state/prepNotes.ts
      (applies flow/strategy-sync-notes.ts's assignNote and saves it)
  → panel re-reads buildPrepNotesPanelView() to refresh
```

Every note create/status-update/assign rule already existed and was
Vitest-covered; this feature closes follow-up (a), "a prep-notes panel UI,"
named under the "🔄 Strategy Sync Notes" bullet in `TODO.md`, adding two
small helpers to `state/prepNotes.ts` — `buildPrepNotesPanelView` (groups
the persisted notes by status for the panel) and `nextPrepNoteStatus` (the
panel's status-cycle order) — rather than introducing new mutation logic.
Vitest-covered in `packages/debate-round/test/prepNotes.test.ts`.

## Known gaps

- No assignee-notification system yet (follow-up (b) — no notification
  system exists in this repo).
- No "jump to argument" link from a note back to its flow box — this panel
  is cross-flow and doesn't mount a live `Flow`, so `resolvePrepNoteBox`
  isn't used here.
- No note-creation UI here — a note is still created against a specific
  flow box elsewhere (e.g. a future flow-view affordance); this panel only
  surfaces and updates existing notes.
