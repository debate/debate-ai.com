/**
 * @fileoverview Which round the recording menu's "Join round recording"
 * joins, and its speeches in order (`@debate-ai/timer`'s
 * `RoundRecordingDialog`). Recordings are saved per speech name
 * (`debate-recording-1AC`), so the items are the format's speech names with
 * cross-ex left out — cross-ex has no recording of its own; it is timed
 * inside a speaker's recording ("Set Timer Cross-X").
 *
 * @module round/round-recording-items
 */

import type { Round } from "../types/flow"

/** Used when the timer runs with no round attached (solo practice). */
export const UNATTACHED_ROUND_ID = "practice"

export function roundRecordingFor(
  round: Pick<Round, "id"> | undefined,
  speeches: ReadonlyArray<{ name: string }> | undefined,
): { roundId: string; items: Array<{ key: string; label: string }> } {
  const seen = new Set<string>()
  const items: Array<{ key: string; label: string }> = []
  for (const { name } of speeches ?? []) {
    if (name.toUpperCase() === "CX" || seen.has(name)) continue
    seen.add(name)
    items.push({ key: name, label: name })
  }
  return { roundId: round ? String(round.id) : UNATTACHED_ROUND_ID, items }
}
