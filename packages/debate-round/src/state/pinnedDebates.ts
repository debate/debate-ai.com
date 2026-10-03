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
 * Pins sync to the signed-in user's account through the `pinnedDebates`
 * collection in `debate-data-sync`'s tool-record catalog. That catalog needs
 * each record to carry a string id, so a pin is stored as
 * `{ id: "<roundId>", roundId, pinnedAt }` rather than a bare number.
 * `Round.id` is also the `saved_rounds.client_id`, so a pin means the same
 * round on every device. `pinnedAt` is what keeps "oldest pin first" true
 * after a merge, where array position no longer is.
 *
 * Browsers that pinned before the sync stored a bare `number[]`; that shape is
 * still read (in array order) and is rewritten as records on the next write.
 *
 * The debate page's start screen reads this to build its "Featured"
 * section, and the round history dialog writes it from each round's pin
 * button.
 *
 * @module state/pinnedDebates
 */

import type { Round } from "../types/flow"

export const PINNED_DEBATES_KEY = "pinned-debates"

/** How many rounds the start screen's featured section shows at most. */
export const MAX_PINNED_DEBATES = 12

/** One pin as stored (and synced): the catalog's `idField` is `id`. */
export interface PinnedDebateRecord {
  /** `String(roundId)` — the string id the tool-record sync keys by. */
  id: string
  roundId: number
  /** Epoch ms the round was pinned; orders the pins oldest first. */
  pinnedAt: number
}

/**
 * Parses the stored value into pins, oldest first. Accepts the legacy bare
 * `number[]` (given synthetic `pinnedAt`s that preserve its order and sort
 * before any real timestamp) and ignores anything unparseable or duplicated.
 */
function parsePins(raw: unknown): PinnedDebateRecord[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<number>()
  const pins: PinnedDebateRecord[] = []
  raw.forEach((entry, index) => {
    let roundId: number | undefined
    let pinnedAt = index
    if (typeof entry === "number") {
      roundId = entry
    } else if (entry && typeof entry === "object") {
      const candidate = entry as Partial<PinnedDebateRecord>
      roundId = candidate.roundId
      if (typeof candidate.pinnedAt === "number" && Number.isFinite(candidate.pinnedAt)) {
        pinnedAt = candidate.pinnedAt
      }
    }
    if (typeof roundId !== "number" || !Number.isFinite(roundId) || seen.has(roundId)) return
    seen.add(roundId)
    pins.push({ id: String(roundId), roundId, pinnedAt })
  })
  // Array.prototype.sort is stable, so equal timestamps keep stored order.
  return pins.sort((a, b) => a.pinnedAt - b.pinnedAt).slice(-MAX_PINNED_DEBATES)
}

function readPins(storage: Pick<Storage, "getItem">): PinnedDebateRecord[] {
  try {
    const raw = storage.getItem(PINNED_DEBATES_KEY)
    return parsePins(raw ? JSON.parse(raw) : [])
  } catch {
    return []
  }
}

function writePins(pins: PinnedDebateRecord[], storage: Pick<Storage, "setItem">): PinnedDebateRecord[] {
  const kept = pins.slice(-MAX_PINNED_DEBATES)
  try {
    storage.setItem(PINNED_DEBATES_KEY, JSON.stringify(kept))
  } catch (error) {
    console.error("Failed to save pinned debates:", error)
  }
  return kept
}

/** The pinned round ids, oldest pin first, ignoring anything unparseable. */
export function readPinnedDebateIds(storage: Pick<Storage, "getItem"> = localStorage): number[] {
  return readPins(storage).map((pin) => pin.roundId)
}

/**
 * Persists `ids` (deduplicated, oldest first) and returns what was stored. An
 * id that was already pinned keeps its original `pinnedAt`; new ids are stamped
 * `now`, in order, so they sort after every existing pin.
 */
export function writePinnedDebateIds(
  ids: number[],
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
  now: number = Date.now(),
): number[] {
  const existing = new Map(readPins(storage).map((pin) => [pin.roundId, pin]))
  const unique = ids.filter((id, index) => ids.indexOf(id) === index)
  let fresh = 0
  const pins = unique.map((roundId): PinnedDebateRecord => {
    const known = existing.get(roundId)
    if (known) return known
    return { id: String(roundId), roundId, pinnedAt: now + fresh++ }
  })
  return writePins(pins, storage).map((pin) => pin.roundId)
}

/**
 * Adds `id` to (or removes it from) the pinned list and persists the result,
 * returning the new id list. Pinning a round that's already at the cap drops
 * the oldest pin so the newest one always fits.
 */
export function togglePinnedDebate(
  id: number,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
  now: number = Date.now(),
): number[] {
  const current = readPinnedDebateIds(storage)
  const next = current.includes(id) ? current.filter((pinned) => pinned !== id) : [...current, id]
  return writePinnedDebateIds(next, storage, now)
}

/**
 * The pinned rounds, in pin order (oldest pin first), skipping ids whose
 * round no longer exists locally. Capped at {@link MAX_PINNED_DEBATES}.
 */
export function orderPinnedRounds(rounds: Round[], pinnedIds: number[]): Round[] {
  const byId = new Map(rounds.map((round) => [round.id, round]))
  return pinnedIds
    .map((id) => byId.get(id))
    .filter((round): round is Round => round !== undefined)
    .slice(0, MAX_PINNED_DEBATES)
}
