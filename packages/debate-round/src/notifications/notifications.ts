/**
 * @fileoverview In-app notification data model + query helpers — closes the
 * "🔄 Strategy Sync Notes" bullet's follow-up (b) in TODO.md: "an assignee
 * notification once a notification system exists." No notification system
 * existed anywhere in this repo, so this slice builds a small, generic one
 * (kept to the single `prep-note-assigned` kind this idea needs) rather than
 * a one-off assignment-specific model, mirroring `strategy-sync-notes.ts`'s
 * pure data-model/query-helper shape. Nothing here persists a
 * `Notification` or renders a notifications UI — see `state/notifications.ts`
 * and `panels/NotificationsPanel.tsx`.
 */

import type { PrepNote } from "../flow/strategy-sync-notes";

/** What triggered a notification. Extend this union as new kinds are wired in. */
export type NotificationKind = "prep-note-assigned";

export type Notification = {
  id: string;
  kind: NotificationKind;
  /** The contributor this notification is for. */
  recipientId: string;
  /** Short, human-readable notice text. */
  message: string;
  /** id of the record the notification is about (e.g. a `PrepNote.id`), for a "jump to" link. */
  sourceId: string;
  read: boolean;
  createdAt: number;
};

/**
 * Builds a `prep-note-assigned` notification for `note`'s current assignee.
 * Returns `null` (no notification to send) when the note isn't assigned, or
 * when it's assigned to its own author — self-assignment isn't worth
 * notifying about.
 */
export function createAssignmentNotification(note: PrepNote, id: string, createdAt: number): Notification | null {
  if (!note.assignedToId || note.assignedToId === note.authorId) {
    return null;
  }

  return {
    id,
    kind: "prep-note-assigned",
    recipientId: note.assignedToId,
    message: `${note.authorId} assigned you a prep note: "${note.text}"`,
    sourceId: note.id,
    read: false,
    createdAt,
  };
}

/** Returns a copy of `notification` marked read. A no-op shape if already read. */
export function markNotificationRead(notification: Notification): Notification {
  return notification.read ? notification : { ...notification, read: true };
}

/** Descending by `createdAt` — most recent notification first. */
export function sortNotificationsByCreatedAt(notifications: Notification[]): Notification[] {
  return [...notifications].sort((a, b) => b.createdAt - a.createdAt);
}

/** All notifications addressed to one recipient, newest first. */
export function getNotificationsForRecipient(notifications: Notification[], recipientId: string): Notification[] {
  return sortNotificationsByCreatedAt(notifications.filter((n) => n.recipientId === recipientId));
}

/** The unread subset of `notifications`, newest first. */
export function getUnreadNotifications(notifications: Notification[]): Notification[] {
  return sortNotificationsByCreatedAt(notifications.filter((n) => !n.read));
}

/**
 * Renders a short, human-readable summary of one recipient's notifications
 * — unread count plus one line per unread notification.
 */
export function buildNotificationSummaryText(notifications: Notification[]): string {
  if (notifications.length === 0) {
    return "No notifications yet.";
  }

  const unread = getUnreadNotifications(notifications);
  const lines = [
    `${notifications.length} notification${notifications.length === 1 ? "" : "s"}: ${unread.length} unread`,
    ...unread.map((n) => `- ${n.message}`),
  ];
  return lines.join("\n");
}
