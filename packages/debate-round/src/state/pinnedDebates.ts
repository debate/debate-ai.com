/**
 * @fileoverview The user's pinned ("featured") debates.
 *
 * A pin is a marker on a round id (synced to the account as the
 * `pinnedDebates` tool-record collection), kept in its own localStorage
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

/**
 * One pin as stored. The account sync (`debate-data-sync`'s
 * `pinnedDebates` collection) needs an array of objects keyed by a string
 * id, so a pin is `{ id: "<round id>", pinnedAt }` rather than a bare
 * number. `pinnedAt` carries the pin order, because the sync's merge
 * appends records pulled from another device after the local ones.
 */
export interface PinnedDebateRecord {
  id: string
  pinnedAt: number
}

/**
 * The pinned round ids, oldest pin first, ignoring anything unparseable.
 * Also reads the legacy `number[]` format (oldest first, array order), which
 * the next write upgrades in place.
 */
export function readPinnedDebateIds(storage: Pick<Storage, "getItem"> = localStorage): number[] {
  try {
    const raw = storage.getItem(PINNED_DEBATES_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    const pins: { id: number; pinnedAt: number }[] = []
    parsed.forEach((entry, index) => {
      if (typeof entry === "number" && Number.isFinite(entry)) {
        pins.push({ id: entry, pinnedAt: index })
      } else if (entry && typeof entry === "object") {
        const { id, pinnedAt } = entry as Partial<PinnedDebateRecord>
        const numericId = typeof id === "string" && id.trim() !== "" ? Number(id) : NaN
        if (Number.isFinite(numericId)) {
          pins.push({ id: numericId, pinnedAt: typeof pinnedAt === "number" ? pinnedAt : index })
        }
      }
    })
    // Stable sort: ties (e.g. all-legacy entries) keep their array order.
    pins.sort((a, b) => a.pinnedAt - b.pinnedAt)
    return pins.map((pin) => pin.id).filter((id, i, all) => all.indexOf(id) === i)
  } catch {
    return []
  }
}

/** Persists `ids` (deduplicated, oldest first) and returns what was stored. */
export function writePinnedDebateIds(
  ids: number[],
  storage: Pick<Storage, "setItem"> & Partial<Pick<Storage, "getItem">> = localStorage,
): number[] {
  const unique = ids.filter((id, index) => ids.indexOf(id) === index).slice(-MAX_PINNED_DEBATES)
  // Keep the original pin time of rounds that stay pinned, so a toggle on
  // one round doesn't rewrite every other record (and re-sync them all).
  const existing = new Map<number, number>()
  try {
    const raw = storage.getItem?.(PINNED_DEBATES_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (entry && typeof entry === "object") {
          const { id, pinnedAt } = entry as Partial<PinnedDebateRecord>
          if (typeof id === "string" && typeof pinnedAt === "number") existing.set(Number(id), pinnedAt)
        }
      }
    }
  } catch {
    // Unreadable previous value: every pin is stamped fresh below.
  }
  const now = Date.now()
  const records: PinnedDebateRecord[] = unique.map((id, index) => ({
    id: String(id),
    pinnedAt: existing.get(id) ?? now + index,
  }))
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
