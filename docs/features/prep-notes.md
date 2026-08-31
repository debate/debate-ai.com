# Prep Notes

Shows every persisted "Strategy Sync Notes" `PrepNote` across every flow,
grouped by status (notes needing follow-up first), with a "cycle status"
action per note and an "assign to" control for handing a note off as a task
to a teammate.

- **Route:** `/prep-notes`
- **Nav:** the Tools page's Prep & Practice group; the Reason Editor's
  Workspace menu (`t prep notes` in Ctrl/Cmd-Shift-Space's command palette)
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
- **Nav:** the Tools page's Prep & Practice group; the Reason Editor's
  Workspace menu (`t notifications` in Ctrl/Cmd-Shift-Space's command palette)
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

### Cross-tab live update

`PrepNoteNotificationsPanel` now also live-updates across browser tabs: a
new assignment or a "Mark read" made in another tab refreshes the currently
looked-up recipient's notification list here too, closing this panel's
share of the "every other localStorage-backed panel in this repo still has
no cross-tab live-update mechanism" Known gap tracked in
[`shared-flow-sync.md`](shared-flow-sync.md). It subscribes to the
browser's `storage` event — fired only in *other* same-origin tabs, never
the one that made the write — and, via `flow/live-update.ts`'s
`isPrepNoteNotificationsLiveUpdateStorageEvent`, re-reads the panel's
notification list whenever the backing `prepNoteNotifications` key changes
(or `localStorage.clear()` fires a `null`-key event). The listener
deliberately ignores `state/prepNoteNotifications.ts`'s separate
`prepNoteNotifications:lastRecipientId` key — which recipient id another
tab last looked up isn't this tab's business. The effect depends on
`recipientId` so a lookup for a different recipient re-registers the
listener with a fresh closure instead of refreshing against a stale one.
Vitest-covered in `packages/debate-round/test/live-update.test.ts` (every
backing-store key, the `null`-key clear-all case, the excluded
recipient-id key, and unrelated/substring-matching keys staying ignored).

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
      to scroll to and flash the box's cell, retrying every 200ms until it
      succeeds or edit-cells.ts's MAX_BOX_JUMP_ATTEMPTS (5) is reached
```

The panel itself still doesn't mount a live `Flow` (it stays cross-flow, so
`resolvePrepNoteBox` isn't used here); the link instead hands off to
`/debate`, which already owns a live flow and its AG Grid. This closes the
"No 'jump to argument' link" gap below.

If the row never resolves — e.g. the note's `boxPath` no longer matches a
real row because the flow was edited or the row removed since the note was
made — `useJumpToPrepNoteBox` gives up after `MAX_BOX_JUMP_ATTEMPTS` retries
and returns `jumpFailed: true`. `DebateFlowPage` renders
`edit-cells.ts`'s `buildBoxJumpFailedMessage()` as a dismissible banner
above the flow grid when that happens, closing the "silently returns
`false`... no error is shown" Known gap below.

## Create a note

Closes the "no note-creation UI" gap below: a `PrepNote` can now be created
directly against the flow box it's about, from the live `/debate` grid
itself, rather than needing a not-yet-built flow-view affordance.

- **Where:** every `FlowSpreadsheet` cell gets a small note badge
  (`PrepNoteBadge`, next to the existing annotation/edit badges) — a filled
  pill with the note count when the box already has one or more notes, or a
  faint always-present affordance when it doesn't (mirrors `EditBadge`'s
  "always visible" pattern, since a box with zero notes is exactly when a
  contributor most wants to add one).
- **Flow:**

  ```
  flow/PrepNoteBadge.tsx          — the cell badge; click opens the popover
    → FlowSpreadsheet.tsx's handleOpenPrepNote(params)
        sets popover state (x, y, boxPath)
    → flow/PrepNotePopover.tsx    — lists the box's existing notes (if any)
                                     and a small "author id" + "text" form
        submit → strategy-sync-notes.ts's createPrepNote(...)
               → state/prepNotes.ts's savePrepNote(note)
        → onCreated() bumps FlowSpreadsheet's refresh token and force-
          refreshes the cell (mirrors handleEditLogged for EditBadge), so
          the badge's count updates immediately
  ```

- **Data:** `state/prepNotes.ts`'s new `listPrepNotesForBox(flowId,
  boxPath)` (wrapping `strategy-sync-notes.ts`'s `getNotesForBox`) feeds
  both the badge's count and the popover's existing-notes list.
- A note created this way immediately shows up in the cross-flow
  `PrepNotesPanel` above (same persisted `PrepNote` store) and can be
  cycled/assigned from either place.

## Known gaps

- ~~If a note's `boxPath` no longer resolves to a real grid row (e.g. the
  flow was edited since the note was made), `jumpToBoxInGrid` silently
  returns `false` — the flow tab still gets selected, but nothing scrolls
  or flashes, and no error is shown.~~ Closed: `useJumpToPrepNoteBox` now
  retries the jump every 200ms up to `MAX_BOX_JUMP_ATTEMPTS` (5) times
  before giving up, and `DebateFlowPage` shows a dismissible
  `buildBoxJumpFailedMessage()` banner above the flow grid once it does
  (see "Jump to argument" above).
- The new note-creation popover's "Author ID" is a free-form typed field,
  not an authenticated identity — there's no auth system in this repo, so
  anyone can type any author id (same gap as `review-queue.md`'s reviewer
  id).
- Notifications are in-app only (no email/push/browser notification) and
  cover prep-note assignment only — no other event in this repo creates
  one yet.
