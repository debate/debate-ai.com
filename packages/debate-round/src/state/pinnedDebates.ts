/**
 * @fileoverview The user's pinned ("featured") debates.
 *
 * A pin is a local-only marker on a round id, kept in its own localStorage
 * key rather than on the `Round` itself: rounds are written wholesale to
 * `rounds` by `useFlowStore().setRounds`, so a `pinned` field on the round
 * object would need re-merging on every write, and a round loaded from the
 * account would silently drop it. Storing ids keeps pinning independent of
 * where the round came from.
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

/** The pinned round ids, oldest pin first, ignoring anything unparseable. */
export function readPinnedDebateIds(storage: Pick<Storage, "getItem"> = localStorage): number[] {
  try {
    const raw = storage.getItem(PINNED_DEBATES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is number => typeof id === "number" && Number.isFinite(id))
  } catch {
    return []
  }
}

/** Persists `ids` (deduplicated, oldest first) and returns what was stored. */
export function writePinnedDebateIds(
  ids: number[],
  storage: Pick<Storage, "setItem"> = localStorage,
): number[] {
  const unique = ids.filter((id, index) => ids.indexOf(id) === index).slice(-MAX_PINNED_DEBATES)
  try {
    storage.setItem(PINNED_DEBATES_KEY, JSON.stringify(unique))
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
export function togglePinnedDebate(id: number, storage?: Pick<Storage, "getItem" | "setItem">): number[] {
  const current = readPinnedDebateIds(storage)
  const next = current.includes(id) ? current.filter((pinned) => pinned !== id) : [...current, id]
  return writePinnedDebateIds(next, storage)
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
