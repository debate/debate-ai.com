/**
 * @fileoverview A shared task checklist for a Collaboration Prep Room — the
 * "a shared task checklist view" follow-up named under the "🧑‍🤝‍🧑
 * Collaboration Prep Room" bullet in TODO.md (the other named follow-up, "a
 * shared file/attachment area," remains open — see the docs' Known gaps).
 *
 * Distinct from the topic's *routed* coverage-gap tasks
 * (`room.routing.assignments`/`unassignedTasks`, recomputed live from the
 * coverage report and contributor roster): a checklist item is a freeform,
 * ad-hoc todo a teammate jots down for the room — "book the practice room,"
 * "print flow sheets," anything that doesn't map onto a tracked argument —
 * so it's modeled and persisted separately rather than folded into
 * `research-task-routing.ts`'s task model. This is the first slice only —
 * it works entirely off a caller-supplied item list; it doesn't persist
 * items or render a checklist UI. See `state/prep-room-checklist.ts` and
 * `panels/PrepRoomPanel.tsx`.
 *
 * @module lib/prep-room-checklist
 */

/** One freeform task on a prep room's shared checklist. */
export interface PrepRoomChecklistItem {
  id: string;
  topic: string;
  text: string;
  done: boolean;
  createdBy: string;
  /** Epoch ms this item was added. */
  createdAt: number;
  /** Epoch ms this item was last marked done, if it currently is. */
  completedAt?: number;
  /** Who last marked this item done, if it currently is. */
  completedBy?: string;
}

/** Hard cap on a single checklist item's text length, enforced before it's ever stored. */
export const MAX_PREP_ROOM_CHECKLIST_ITEM_TEXT_LENGTH = 200;

/**
 * Returns a copy of `items` with a new checklist item appended for `topic`,
 * trimming `text`/`createdBy` and capping `text` at
 * `MAX_PREP_ROOM_CHECKLIST_ITEM_TEXT_LENGTH`. Callers
 * (`state/prep-room-checklist.ts`) are expected to reject blank text/topic
 * before calling this, mirroring `state/prepNoteReplies.ts#postPrepNoteReply`'s
 * "trust the caller already validated" convention.
 */
export function addChecklistItem(
  items: PrepRoomChecklistItem[],
  input: { id: string; topic: string; text: string; createdBy: string; atMs: number },
): PrepRoomChecklistItem[] {
  const item: PrepRoomChecklistItem = {
    id: input.id,
    topic: input.topic.trim(),
    text: input.text.trim().slice(0, MAX_PREP_ROOM_CHECKLIST_ITEM_TEXT_LENGTH),
    done: false,
    createdBy: input.createdBy.trim(),
    createdAt: input.atMs,
  };
  return [...items, item];
}

/**
 * Returns a copy of `items` with the item matching `id` toggled to `done`,
 * stamping (or clearing) `completedAt`/`completedBy` accordingly. A no-op
 * copy when no item matches `id`.
 */
export function toggleChecklistItem(
  items: PrepRoomChecklistItem[],
  id: string,
  done: boolean,
  actorId: string,
  atMs: number,
): PrepRoomChecklistItem[] {
  return items.map((item) => {
    if (item.id !== id) return item;
    return done
      ? { ...item, done: true, completedAt: atMs, completedBy: actorId.trim() }
      : { ...item, done: false, completedAt: undefined, completedBy: undefined };
  });
}

/** Returns a copy of `items` with the item matching `id` removed (a no-op copy if none matches). */
export function deleteChecklistItem(items: PrepRoomChecklistItem[], id: string): PrepRoomChecklistItem[] {
  return items.filter((item) => item.id !== id);
}

/**
 * Lists `topic`'s checklist items for display: still-open items first
 * (oldest first, so the earliest-added task surfaces first), then done
 * items (most recently completed first, so a just-finished task stays
 * visible near the top of its group instead of sinking to the bottom).
 */
export function listChecklistItemsForTopic(items: PrepRoomChecklistItem[], topic: string): PrepRoomChecklistItem[] {
  const scoped = items.filter((item) => item.topic === topic);
  const open = scoped.filter((item) => !item.done).sort((a, b) => a.createdAt - b.createdAt);
  const done = scoped.filter((item) => item.done).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  return [...open, ...done];
}

/**
 * Renders a topic's checklist as a short "N of M tasks done" summary line
 * for a prep-room header, mirroring `topic-presence.ts#buildPresenceSummaryText`'s
 * short-status-line convention.
 */
export function buildChecklistSummaryText(items: PrepRoomChecklistItem[], topic: string): string {
  const scoped = items.filter((item) => item.topic === topic);
  if (scoped.length === 0) return "No checklist tasks yet.";
  const doneCount = scoped.filter((item) => item.done).length;
  return `${doneCount} of ${scoped.length} tasks done`;
}
