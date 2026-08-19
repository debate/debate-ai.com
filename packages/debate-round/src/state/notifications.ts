/**
 * @fileoverview Persistent storage for `notifications.ts`'s `Notification`
 * records, mirroring `state/prepNotes.ts`'s localStorage persistence
 * convention. `assignPersistedPrepNoteAndNotify` composes this store with
 * `state/prepNotes.ts`'s existing `assignPersistedPrepNote`, so assigning a
 * prep note and notifying its assignee happen as one call — closing the
 * "🔄 Strategy Sync Notes" bullet's follow-up (b) in TODO.md.
 *
 * @module state/notifications
 */

import type { Notification } from "../notifications/notifications";
import {
  createAssignmentNotification,
  getNotificationsForRecipient,
  markNotificationRead,
} from "../notifications/notifications";
import type { PrepNote } from "../flow/strategy-sync-notes";
import { assignPersistedPrepNote } from "./prepNotes";

const STORAGE_KEY = "notifications";

function readAll(): Notification[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Notification[]) : [];
  } catch {
    return [];
  }
}

function writeAll(notifications: Notification[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
}

/** Lists every persisted notification, across all recipients. */
export function listNotifications(): Notification[] {
  return readAll();
}

/** Lists a recipient's persisted notifications, newest first. */
export function listNotificationsForRecipient(recipientId: string): Notification[] {
  return getNotificationsForRecipient(readAll(), recipientId);
}

/** Looks up a single persisted notification by id, if any. */
export function getNotification(id: string): Notification | undefined {
  return readAll().find((n) => n.id === id);
}

/** Saves a notification, overwriting any existing record with the same id. */
export function saveNotification(notification: Notification): void {
  const notifications = readAll();
  const index = notifications.findIndex((existing) => existing.id === notification.id);
  if (index === -1) {
    notifications.push(notification);
  } else {
    notifications[index] = notification;
  }
  writeAll(notifications);
}

/**
 * Applies `markNotificationRead` to the persisted notification with `id`
 * and saves the result. Returns the updated notification, or `undefined`
 * (leaving storage untouched) if no notification with that id is stored.
 */
export function markPersistedNotificationRead(id: string): Notification | undefined {
  const notification = getNotification(id);
  if (!notification) return undefined;

  const updated = markNotificationRead(notification);
  saveNotification(updated);
  return updated;
}

/**
 * Builds and saves a `prep-note-assigned` notification for `note`'s
 * assignee, if any (see `createAssignmentNotification` for when it's
 * skipped — no assignee, or self-assignment). Returns the saved
 * notification, or `undefined` if none was created.
 */
export function notifyPrepNoteAssignment(note: PrepNote, id: string, createdAt: number): Notification | undefined {
  const notification = createAssignmentNotification(note, id, createdAt);
  if (!notification) return undefined;

  saveNotification(notification);
  return notification;
}

/**
 * Assigns a persisted `PrepNote` (via `assignPersistedPrepNote`) and, in the
 * same call, creates and saves its assignee's notification. This is the
 * function a panel's "assign" action should call instead of
 * `assignPersistedPrepNote` directly, so assignment and notification never
 * drift out of sync.
 */
export function assignPersistedPrepNoteAndNotify(
  id: string,
  assignedToId: string | null,
  updatedAt: number,
  notificationId: string,
): PrepNote | undefined {
  const updated = assignPersistedPrepNote(id, assignedToId, updatedAt);
  if (!updated) return undefined;

  notifyPrepNoteAssignment(updated, notificationId, updatedAt);
  return updated;
}
