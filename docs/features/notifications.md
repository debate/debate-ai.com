# Notifications

An in-app notification a contributor can see and mark read — closing the
"🔄 Strategy Sync Notes" bullet's follow-up (b) in `TODO.md`: "an assignee
notification once a notification system exists." No notification system
existed anywhere in this repo before this slice, so it's kept generic (a
`Notification` model with a single `prep-note-assigned` kind today) rather
than one-off assignment-specific state, so a later feature can add its own
kind without redesigning storage.

- **Route:** `/notifications`
- **Nav:** the global dock's Settings menu → **Notifications**
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

A recipient id field (this repo has no auth/identity system yet, so the
viewer types who they are — the same caller-supplied-id convention every
other panel in this repo uses), then that recipient's persisted
notifications in two groups:

| Group | Contents |
| --- | --- |
| Unread | Newest first, each with a "Mark read" action |
| Read | Newest first, no action |

Each notification shows its `message` (e.g. `alice assigned you a prep
note: "Answer the solvency turn"`).

## Data flow

```
Assigning a PrepNote (PrepNotesPanel.tsx's "Assign"/"Reassign"/"Unassign"):
panels/PrepNotesPanel.tsx
  → assignPersistedPrepNoteAndNotify(id, assignedToId, updatedAt, notificationId)  — state/notifications.ts
      ├─ assignPersistedPrepNote(id, assignedToId, updatedAt)  — state/prepNotes.ts (unchanged)
      └─ notifyPrepNoteAssignment(updatedNote, notificationId, updatedAt)  — state/notifications.ts
           → createAssignmentNotification(note, id, createdAt)  — notifications/notifications.ts
             (returns null — no notification saved — when the note has no
             assignee, or is assigned to its own author)
           → saveNotification(notification)

Viewing notifications:
state/notifications.ts (localStorage: notifications)
  → listNotificationsForRecipient(recipientId)  — filters + sorts newest first
  → panels/NotificationsPanel.tsx               — renders it, unread/read grouped

Marking a notification read:
panels/NotificationsPanel.tsx
  → markPersistedNotificationRead(id)  — state/notifications.ts
      → markNotificationRead(notification)  — notifications/notifications.ts
  → panel re-reads listNotificationsForRecipient(recipientId) to refresh
```

This feature adds `packages/debate-round/src/notifications/notifications.ts`
(the pure `Notification` model, `createAssignmentNotification`,
`markNotificationRead`, `getNotificationsForRecipient`,
`getUnreadNotifications`, `buildNotificationSummaryText`) and
`packages/debate-round/src/state/notifications.ts` (the localStorage store,
plus the `assignPersistedPrepNoteAndNotify` composition that wraps the
existing `assignPersistedPrepNote` — that function itself is unchanged).
`PrepNotesPanel`'s assign/unassign actions now call the wrapped function
instead of `assignPersistedPrepNote` directly; no other mutation logic
changed. Vitest-covered in
`packages/debate-round/test/notifications.test.ts`.

## Known gaps

- No contributor identity/permission checks (no auth/roles in this repo
  yet), so any visitor can view or mark read any recipient id's
  notifications by typing that id.
- Only one notification kind exists (`prep-note-assigned`); no other
  assignment or event in this repo triggers a notification yet.
- No live/push delivery — a recipient only sees new notifications after
  visiting `/notifications` and looking them up again.
