/**
 * @fileoverview The user's pinned ("featured") debates.
 *
 * A pin is a marker on a round id, kept in its own localStorage key rather
 * than on the `Round` itself: rounds are written wholesale to `rounds` by
 * `useFlowStore().setRounds`, so a `pinned` field on the round object would
 * need re-merging on every write, and a round loaded from the account would
 * silently drop it. Storing ids keeps pinning independent of where the round
 * came from.
 *
 * Pins are stored as `{ id, roundId, pinnedAt }` records under
 * {@link PINNED_DEBATES_KEY}, the shape `@debate/data-sync`'s
 * `pinnedDebates` tool-record collection syncs to a signed-in user's account,
 * so a featured round follows its owner to another device (a round's local id
 * is also its `saved_rounds.client_id`, so the pin still points at the same
 * round there). The older `pinned-debates` key held a bare `number[]`; it is
 * read once as a fallback and superseded on the first write.
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

/** One pin: the round and when it was pinned. `id` is the sync identity. */
export interface PinnedDebateRecord {
  id: string
  roundId: number
  pinnedAt: number
}

/** The sync id for a round's pin. */
export function pinnedDebateRecordId(roundId: number): string {
  return `round-${roundId}`
}

function isPinnedDebateRecord(value: unknown): value is PinnedDebateRecord {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.roundId === "number" &&
    Number.isFinite(record.roundId) &&
    typeof record.pinnedAt === "number" &&
    Number.isFinite(record.pinnedAt)
  )
}

function readJson(storage: Pick<Storage, "getItem">, key: string): unknown {
  try {
    const raw = storage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** The stored pin records, oldest pin first, ignoring anything malformed or duplicated. */
export function readPinnedDebateRecords(
  storage: Pick<Storage, "getItem"> = localStorage,
): PinnedDebateRecord[] {
  const stored = readJson(storage, PINNED_DEBATES_KEY)
  if (Array.isArray(stored)) {
    const seen = new Set<number>()
    return stored
      .filter(isPinnedDebateRecord)
      .filter((record) => (seen.has(record.roundId) ? false : (seen.add(record.roundId), true)))
      .map((record) => ({
        id: pinnedDebateRecordId(record.roundId),
        roundId: record.roundId,
        pinnedAt: record.pinnedAt,
      }))
      .sort((a, b) => a.pinnedAt - b.pinnedAt)
  }

  // Nothing under the new key yet: lift the legacy id list, keeping its order
  // by giving each id a pinnedAt of its position.
  const legacy = readJson(storage, LEGACY_PINNED_DEBATES_KEY)
  if (!Array.isArray(legacy)) return []
  return legacy
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id))
    .filter((id, index, ids) => ids.indexOf(id) === index)
    .map((roundId, index) => ({ id: pinnedDebateRecordId(roundId), roundId, pinnedAt: index }))
}

/** The pinned round ids, oldest pin first, ignoring anything unparseable. */
export function readPinnedDebateIds(storage: Pick<Storage, "getItem"> = localStorage): number[] {
  return readPinnedDebateRecords(storage).map((record) => record.roundId)
}

/** Persists `ids` (deduplicated, oldest first) and returns what was stored. */
export function writePinnedDebateIds(
  ids: number[],
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
  now: number = Date.now(),
): number[] {
  const unique = ids.filter((id, index) => ids.indexOf(id) === index).slice(-MAX_PINNED_DEBATES)
  // Keep an existing pin's timestamp so unrelated pins are not rewritten (and
  // re-synced) every time one changes; new pins are stamped after all of them.
  const existing = new Map(readPinnedDebateRecords(storage).map((r) => [r.roundId, r.pinnedAt]))
  let next = Math.max(now, ...existing.values(), 0)
  const records = unique.map((roundId) => {
    const pinnedAt = existing.get(roundId)
    if (pinnedAt !== undefined) return { id: pinnedDebateRecordId(roundId), roundId, pinnedAt }
    next += 1
    return { id: pinnedDebateRecordId(roundId), roundId, pinnedAt: next }
  })
  try {
    storage.setItem(PINNED_DEBATES_KEY, JSON.stringify(records))
  } catch (error) {
    console.error("Failed to save pinned debates:", error)
  }
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
  return writePinnedDebateIds(next, storage)
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
