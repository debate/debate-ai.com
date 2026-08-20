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
      (on a real assignment, also calls recordPrepNoteAssignedNotification —
       state/prepNoteNotifications.ts — to notify the new assignee)
  → panel re-reads buildPrepNotesPanelView() to refresh

Notifying an assignee (closes follow-up (b), see "Notifications" below):
state/prepNotes.ts's assignPersistedPrepNote(id, assignedToId, now)
  → recordPrepNoteAssignedNotification(id, note, assignedToId, now)  — state/prepNoteNotifications.ts
      (builds flow/prep-note-notifications.ts's PrepNoteNotification via
       createPrepNoteAssignedNotification and saves it — skipped on an
       unassignment, i.e. assignedToId === null)
```

Every note create/status-update/assign rule already existed and was
Vitest-covered; this feature closes follow-up (a), "a prep-notes panel UI,"
named under the "🔄 Strategy Sync Notes" bullet in `TODO.md`, adding two
small helpers to `state/prepNotes.ts` — `buildPrepNotesPanelView` (groups
the persisted notes by status for the panel) and `nextPrepNoteStatus` (the
panel's status-cycle order) — rather than introducing new mutation logic.
Vitest-covered in `packages/debate-round/test/prepNotes.test.ts`.

## Notifications

Closes follow-up (b), "an assignee notification once a notification system
exists." This is the first notification system in this repo, scoped
narrowly to the one event that follow-up named — a `PrepNote` being
assigned to a teammate — rather than a general-purpose system for events
that don't exist yet.

- **Route:** `/notifications`
- **Nav:** the global dock's Settings menu → **Notifications**
- **Model:** `flow/prep-note-notifications.ts`'s `PrepNoteNotification`
  (recipient id, the note's text/author at assignment time, read status).
  There's no auth/identity system in this repo, so a recipient is a
  free-form id — the same `assignedToId` a `PrepNote` is assigned to.
- **Persistence:** `state/prepNoteNotifications.ts` (localStorage:
  `prepNoteNotifications`), wired directly into `assignPersistedPrepNote`
  so a real assignment always records one — no caller has to remember to.
- **UI:** `panels/PrepNoteNotificationsPanel.tsx` asks for a recipient id
  (remembered in localStorage across visits) and renders that recipient's
  notifications newest first, with a "Mark read" action per unread
  notification.

## Jump to argument

Each note in `PrepNotesPanel` has a **Jump to argument** link that takes
you to `/debate` and scrolls the note's flow into view, flashing its cell.

```
flow/strategy-sync-notes.ts
  buildPrepNoteJumpHref(note)             — /debate?flowId=<id>&boxPath=<path>
  parsePrepNoteJumpParams(searchParams)   — the inverse, tolerant of a
                                             missing/malformed flowId or
                                             boxPath (returns null rather
                                             than throwing)

hooks/useJumpToPrepNoteBox.ts (mounted by DebateFlowPage)
  reads the URL's flowId/boxPath via parsePrepNoteJumpParams
    → selects the matching flow tab by id (flows.findIndex, not the
      store's array-index `selected`)
    → once that flow's AG Grid has the target row rendered — either
      immediately (grid already mounted) or once its onGridReady fires
      (fresh mount) — calls edit-cells.ts's jumpToBoxInGrid(api, boxPath)
      to scroll to and flash the box's cell
```

The panel itself still doesn't mount a live `Flow` (it stays cross-flow, so
`resolvePrepNoteBox` isn't used here); the link instead hands off to
`/debate`, which already owns a live flow and its AG Grid. This closes the
"No 'jump to argument' link" gap below.

## Known gaps

- If a note's `boxPath` no longer resolves to a real grid row (e.g. the
  flow was edited since the note was made), `jumpToBoxInGrid` silently
  returns `false` — the flow tab still gets selected, but nothing scrolls
  or flashes, and no error is shown.
- No note-creation UI here — a note is still created against a specific
  flow box elsewhere (e.g. a future flow-view affordance); this panel only
  surfaces and updates existing notes.
- Notifications are in-app only (no email/push/browser notification) and
  cover prep-note assignment only — no other event in this repo creates
  one yet.
