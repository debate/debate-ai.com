/**
 * @fileoverview Assignee-notification data model + query helpers for the
 * "🔄 Strategy Sync Notes" idea in TODO.md — closes that idea's follow-up
 * (b), "an assignee notification once a notification system exists." No
 * notification system existed in this repo before this slice; this is the
 * first one, scoped narrowly to a `PrepNote` being assigned to a teammate
 * (the only notification-worthy event named in that follow-up), rather
 * than a speculative, general-purpose notification system for events that
 * don't exist yet.
 *
 * A `PrepNoteNotification` is addressed to a recipient (a `PrepNote`'s
 * `assignedToId`) the same way a note itself is addressed to an author —
 * a free-form id, since this repo has no auth/identity system. This is
 * pure data-model/query logic over caller-supplied notifications; nothing
 * in this repo persists a `PrepNoteNotification` or renders a
 * notifications UI yet — see `state/prepNoteNotifications.ts` and
 * `panels/PrepNoteNotificationsPanel.tsx`.
 */

import type { PrepNote } from "./strategy-sync-notes";

export type PrepNoteNotification = {
  id: string;
  recipientId: string;
  prepNoteId: string;
  /** The note's text at the moment it was assigned, so the notification still reads sensibly if the note later changes. */
  noteText: string;
  /** The note's author — this repo has no auth/identity system, so there is no separate "who performed the assignment" actor to record. */
  noteAuthorId: string;
  createdAt: number;
  read: boolean;
};

export type CreatePrepNoteAssignedNotificationInput = {
  id: string;
  note: PrepNote;
  recipientId: string;
  createdAt: number;
};

/**
 * Builds a "you were assigned a prep note" notification, validating that
 * it actually has a recipient. `note`'s current `text`/`authorId` are
 * copied in at build time (not looked up live later).
 */
export function createPrepNoteAssignedNotification(
  input: CreatePrepNoteAssignedNotificationInput,
): PrepNoteNotification {
  if (!input.recipientId.trim()) {
    throw new Error("createPrepNoteAssignedNotification: recipientId is required");
  }

  return {
    id: input.id,
    recipientId: input.recipientId,
    prepNoteId: input.note.id,
    noteText: input.note.text,
    noteAuthorId: input.note.authorId,
    createdAt: input.createdAt,
    read: false,
  };
}

/** Returns a copy of `notification` marked read. A no-op copy if it's already read. */
export function markNotificationRead(notification: PrepNoteNotification): PrepNoteNotification {
  return { ...notification, read: true };
}

/** Descending by `createdAt` (newest first), without mutating the input array — the order a notification feed should read. */
export function sortNotificationsByCreatedAt(
  notifications: PrepNoteNotification[],
): PrepNoteNotification[] {
  return [...notifications].sort((a, b) => b.createdAt - a.createdAt);
}

/** All notifications addressed to one recipient, newest first. */
export function getNotificationsForRecipient(
  notifications: PrepNoteNotification[],
  recipientId: string,
): PrepNoteNotification[] {
  return sortNotificationsByCreatedAt(
    notifications.filter((notification) => notification.recipientId === recipientId),
  );
}

/** All unread notifications, newest first. */
export function getUnreadNotifications(notifications: PrepNoteNotification[]): PrepNoteNotification[] {
  return sortNotificationsByCreatedAt(notifications.filter((notification) => !notification.read));
}

/** Count of unread notifications addressed to one recipient — for an unread badge. */
export function countUnreadForRecipient(notifications: PrepNoteNotification[], recipientId: string): number {
  return getNotificationsForRecipient(notifications, recipientId).filter((notification) => !notification.read)
    .length;
}

/**
 * Renders a short, human-readable summary of a recipient's notifications —
 * an unread count plus one line per unread notification — mirroring
 * `strategy-sync-notes.ts`'s `buildPrepNoteSummaryText`.
 */
export function buildNotificationSummaryText(
  notifications: PrepNoteNotification[],
  recipientId: string,
): string {
  const forRecipient = getNotificationsForRecipient(notifications, recipientId);
  if (forRecipient.length === 0) {
    return "No notifications yet.";
  }

  const unread = forRecipient.filter((notification) => !notification.read);
  const lines = [
    `${forRecipient.length} notification${forRecipient.length === 1 ? "" : "s"}: ${unread.length} unread`,
    ...unread.map(
      (notification) => `- "${notification.noteText}" (from a note by ${notification.noteAuthorId})`,
    ),
  ];
  return lines.join("\n");
}
