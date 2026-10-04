/**
 * @fileoverview The user's pinned ("featured") debates.
 *
 * A pin is a marker on a round id, kept in its own localStorage key rather
 * than on the `Round` itself: rounds are written wholesale to
 * `rounds` by `useFlowStore().setRounds`, so a `pinned` field on the round
 * object would need re-merging on every write, and a round loaded from the
 * account would silently drop it. Storing ids keeps pinning independent of
 * where the round came from.
 *
 * Each pin is stored as a `{ roundId, pinnedAt }` record (the `roundId` is a
 * string because the account sync keys records by a string field) under the
 * `pinnedDebates` collection in `debate-data-sync`'s tool-record catalog, so a
 * signed-in user's pins follow them across devices. A round's local id is its
 * `saved_rounds.client_id`, which survives a cloud save, so the same id names
 * the same round on every device. Browsers written before the sync stored a
 * bare `number[]`; {@link readPinnedDebateIds} still reads that and rewrites it
 * in the record shape.
 *
 * The debate page's start screen reads this to build its "Featured"
 * section, and the round history dialog writes it from each round's pin
 * button.
 *
 * @module state/pinnedDebates
 */

import type { Round } from "../types/flow"

/** Key of the synced pin records. Matches the `pinnedDebates` catalog entry's `storageKey`. */
export const PINNED_DEBATES_KEY = "pinnedDebates"

/** The pre-sync key, a bare `number[]` of round ids. Read-only fallback. */
export const LEGACY_PINNED_DEBATES_KEY = "pinned-debates"

/** How many rounds the start screen's featured section shows at most. */
export const MAX_PINNED_DEBATES = 12

/** One pin as stored (and synced) — see the file header for why `roundId` is a string. */
export interface PinnedDebateRecord {
  roundId: string
  pinnedAt: number
}

/** A stored entry as a pin record, or null when it isn't a usable pin. */
function toPinRecord(entry: unknown, fallbackPinnedAt: number): PinnedDebateRecord | null {
  const isObject = entry !== null && typeof entry === "object"
  const rawId = isObject ? (entry as { roundId?: unknown }).roundId : entry
  const id = typeof rawId === "string" && rawId.trim() !== "" ? Number(rawId) : rawId
  if (typeof id !== "number" || !Number.isFinite(id)) return null
  const rawAt = isObject ? (entry as { pinnedAt?: unknown }).pinnedAt : undefined
  const pinnedAt = typeof rawAt === "number" && Number.isFinite(rawAt) ? rawAt : fallbackPinnedAt
  return { roundId: String(id), pinnedAt }
}

function writeRecords(records: PinnedDebateRecord[], storage: Pick<Storage, "setItem">) {
  try {
    storage.setItem(PINNED_DEBATES_KEY, JSON.stringify(records))
  } catch (error) {
    console.error("Failed to save pinned debates:", error)
  }
}

/**
 * The stored pins, oldest first, deduplicated and without anything
 * unparseable. Accepts both stored shapes and rewrites a legacy `number[]` as
 * records so the account sync (which can only key object records) picks it up.
 */
function readRecords(
  storage: Pick<Storage, "getItem"> & Partial<Pick<Storage, "setItem">>,
): PinnedDebateRecord[] {
  try {
    const raw = storage.getItem(PINNED_DEBATES_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    // Legacy entries carry no pin time; one shared value keeps array order.
    const now = Date.now()
    const records = parsed
      .map((entry) => toPinRecord(entry, now))
      .filter((record): record is PinnedDebateRecord => record !== null)
      .filter((record, index, all) => all.findIndex((r) => r.roundId === record.roundId) === index)
    if (storage.setItem && parsed.some((entry) => entry === null || typeof entry !== "object")) {
      writeRecords(records, storage as Pick<Storage, "setItem">)
    }
    return records
  } catch {
    return []
  }
}

/** The pinned round ids, oldest pin first, ignoring anything unparseable. */
export function readPinnedDebateIds(
  storage: Pick<Storage, "getItem"> & Partial<Pick<Storage, "setItem">> = localStorage,
): number[] {
  return readRecords(storage).map((record) => Number(record.roundId))
}

/** Persists `ids` (deduplicated, oldest first) and returns what was stored. */
export function writePinnedDebateIds(
  ids: number[],
  storage: Pick<Storage, "setItem"> & Partial<Pick<Storage, "getItem">> = localStorage,
): number[] {
  const unique = ids.filter((id, index) => ids.indexOf(id) === index).slice(-MAX_PINNED_DEBATES)
  // Keep the pin time of a round that stays pinned: a fresh stamp on every
  // write would make the sync re-send every pin each time one changes.
  const existing = new Map(
    (storage.getItem ? readRecords(storage as Pick<Storage, "getItem">) : []).map((r) => [
      r.roundId,
      r.pinnedAt,
    ]),
  )
  const now = Date.now()
  writeRecords(
    unique.map((id) => ({ roundId: String(id), pinnedAt: existing.get(String(id)) ?? now })),
    storage,
  )
  return unique
}

/**
 * Adds `id` to (or removes it from) the pinned list and persists the result,
 * returning the new id list. Pinning a round that's already at the cap drops
 * the oldest pin so the newest one always fits.
 */
export function togglePinnedDebate(
  id: number,
  storage?: Pick<Storage, "getItem" | "setItem">,
): number[] {
  const current = readPinnedDebateIds(storage)
  const next = current.includes(id) ? current.filter((pinned) => pinned !== id) : [...current, id]
  return writePinnedDebateIds(next, storage, now)
}

/**
 * The pinned rounds, in pin order (oldest pin first), skipping ids whose
 * round no longer exists locally. Capped at the {@link MAX_PINNED_DEBATES}
 * newest pins, since pins merged in from another device can exceed the cap.
 */
export function orderPinnedRounds(rounds: Round[], pinnedIds: number[]): Round[] {
  const byId = new Map(rounds.map((round) => [round.id, round]))
  return pinnedIds
    .map((id) => byId.get(id))
    .filter((round): round is Round => round !== undefined)
    .slice(-MAX_PINNED_DEBATES)
}
