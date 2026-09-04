/**
 * @fileoverview Persistent storage for `prep-room-checklist.ts`'s
 * `PrepRoomChecklistItem` records — closes the "a shared task checklist
 * view" follow-up named under the "🧑‍🤝‍🧑 Collaboration Prep Room" bullet in
 * TODO.md. Stores items in localStorage, mirroring the existing
 * `topicPresence.ts`/`prepNoteReplies.ts` persistence convention.
 *
 * Local-first only, same known gap as the rest of this room's state
 * (`state/prepRooms.ts`, `state/topicPresence.ts`): no account-sync
 * counterpart yet, so a checklist is per-browser, not truly shared across a
 * team's different devices.
 *
 * @module state/prepRoomChecklist
 */

import type { PrepRoomChecklistItem } from "../lib/prep-room-checklist";
import {
  addChecklistItem,
  deleteChecklistItem,
  listChecklistItemsForTopic,
  toggleChecklistItem,
} from "../lib/prep-room-checklist";

const STORAGE_KEY = "prepRoomChecklist";

function readAll(): PrepRoomChecklistItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PrepRoomChecklistItem[]) : [];
  } catch {
    return [];
  }
}

function writeAll(items: PrepRoomChecklistItem[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function generateChecklistItemId(): string {
  return `prep-room-checklist-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Lists every persisted checklist item, across all topics. */
export function listAllPrepRoomChecklistItems(): PrepRoomChecklistItem[] {
  return readAll();
}

/**
 * Lists `topic`'s persisted checklist items via `listChecklistItemsForTopic`
 * — open items first (oldest first), then done items (most recently
 * completed first).
 */
export function listPersistedChecklistItems(topic: string): PrepRoomChecklistItem[] {
  return listChecklistItemsForTopic(readAll(), topic);
}

/**
 * Adds a new checklist item to `topic` and persists it. Returns `undefined`
 * (leaving storage untouched) when `text` or `createdBy` is blank after
 * trimming, rather than storing an empty task.
 */
export function addPersistedChecklistItem(
  topic: string,
  text: string,
  createdBy: string,
  atMs: number,
): PrepRoomChecklistItem | undefined {
  if (!text.trim() || !createdBy.trim() || !topic.trim()) return undefined;

  const id = generateChecklistItemId();
  const items = addChecklistItem(readAll(), { id, topic, text, createdBy, atMs });
  writeAll(items);
  return items.find((item) => item.id === id);
}

/**
 * Toggles a persisted checklist item's done state and saves the result.
 * Returns the updated item, or `undefined` (leaving storage untouched) if
 * no item with that id is stored.
 */
export function togglePersistedChecklistItem(
  id: string,
  done: boolean,
  actorId: string,
  atMs: number,
): PrepRoomChecklistItem | undefined {
  const items = toggleChecklistItem(readAll(), id, done, actorId, atMs);
  writeAll(items);
  return items.find((item) => item.id === id);
}

/** Deletes a persisted checklist item by id (a no-op if it isn't stored). */
export function deletePersistedChecklistItem(id: string): void {
  writeAll(deleteChecklistItem(readAll(), id));
}
