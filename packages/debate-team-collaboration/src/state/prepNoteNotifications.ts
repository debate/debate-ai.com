/**
 * @fileoverview Persistent storage for `flow/prep-note-notifications.ts`'s
 * `PrepNoteNotification` records — closes the "an assignee notification
 * once a notification system exists" follow-up (b) named under the "🔄
 * Strategy Sync Notes" bullet in TODO.md. Stores notifications in
 * localStorage, mirroring `state/prepNotes.ts`'s persistence convention.
 *
 * `state/prepNotes.ts`'s `assignPersistedPrepNote` calls
 * `recordPrepNoteAssignedNotification` whenever a note is assigned to a
 * teammate (not when it's unassigned), so a real assignment actually
 * notifies its recipient instead of requiring a caller to build and save
 * the notification itself.
 *
 * `buildNotificationsPanelView` supports the notifications panel UI — see
 * `panels/PrepNoteNotificationsPanel.tsx`.
 *
 * @module state/prepNoteNotifications
 */

import type { PrepNote } from "debate-round/src/flow/strategy-sync-notes";
import {
  createPrepNoteAssignedNotification,
  getNotificationsForRecipient,
  markNotificationRead,
  type PrepNoteNotification,
} from "../flow/prep-note-notifications";

const STORAGE_KEY = "prepNoteNotifications";

function readAll(): PrepNoteNotification[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PrepNoteNotification[]) : [];
  } catch {
    return [];
  }
}

function writeAll(notifications: PrepNoteNotification[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
}

/** Lists every persisted notification, across all recipients. */
export function listNotifications(): PrepNoteNotification[] {
  return readAll();
}

/** Lists every persisted notification for one recipient, newest first. */
export function listNotificationsForRecipient(recipientId: string): PrepNoteNotification[] {
  return getNotificationsForRecipient(readAll(), recipientId);
}

/** Looks up a single persisted notification by id, if any. */
export function getNotification(id: string): PrepNoteNotification | undefined {
  return readAll().find((notification) => notification.id === id);
}

/** Saves a notification, overwriting any existing record with the same id. */
export function saveNotification(notification: PrepNoteNotification): void {
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
 * Builds a "you were assigned a prep note" notification for `note`'s new
 * assignee and persists it. This is the composition slice `assignPersistedPrepNote`
 * calls on every real assignment — see `state/prepNotes.ts`.
 */
export function recordPrepNoteAssignedNotification(
  id: string,
  note: PrepNote,
  recipientId: string,
  createdAt: number,
): PrepNoteNotification {
  const notification = createPrepNoteAssignedNotification({
    id,
    note,
    recipientId,
    createdAt,
  });
  saveNotification(notification);
  return notification;
}

/**
 * Applies `markNotificationRead` to the persisted notification with `id`
 * and saves the result. Returns the updated notification, or `undefined`
 * (leaving storage untouched) if no notification with that id is stored.
 */
export function markPersistedNotificationRead(id: string): PrepNoteNotification | undefined {
  const notification = getNotification(id);
  if (!notification) return undefined;

  const updated = markNotificationRead(notification);
  saveNotification(updated);
  return updated;
}

/**
 * Reads every persisted notification for one recipient (newest first) —
 * used by `PrepNoteNotificationsPanel` to render a recipient's feed.
 */
export function buildNotificationsPanelView(recipientId: string): PrepNoteNotification[] {
  return getNotificationsForRecipient(readAll(), recipientId);
}
