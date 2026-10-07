/**
 * @fileoverview Pure helper for working out which of a round's speeches the
 * viewer gives, so the sidebar's round group (`layout/LiveRoundGroup.tsx`)
 * can highlight them.
 *
 * A round's `debaters.aff` / `debaters.neg` pairs hold *emails* (see
 * `round/round-participants.ts`), in speaker order. Each timer speech names
 * its speaker with a short code from `@debate/timer`'s format table — "1A" /
 * "2N" in Policy, "A1" / "N2" in PF, plain "A" / "N" in LD — so the side
 * comes from the A/N letter and the debater from the 1/2 digit. A code with
 * no digit (LD's one-person sides) belongs to whoever is on that side.
 *
 * @module round/my-speeches
 */

import type { Round } from "../types/flow"

/** The bits of a timer speech this helper reads. */
export interface SpeakerSpeech {
  /** Speaker code, e.g. "1A", "N2" or "A". */
  speaker?: string
  /** Whether the speech belongs to the neg — used when there's no speaker code. */
  secondary: boolean
}

/** Where the viewer sits in a round: their side and debater slot (0 or 1). */
export interface ViewerSeat {
  side: "aff" | "neg"
  index: number
}

const normalize = (email: string | null | undefined) => (email ?? "").trim().toLowerCase()

/**
 * Finds the viewer's seat in a round from their email(s). Returns `null` when
 * there's no round, no email, or the viewer isn't one of its debaters (a
 * judge or spectator gives no speeches).
 */
export function findViewerSeat(
  round: Round | null | undefined,
  viewerEmails: readonly (string | null | undefined)[],
): ViewerSeat | null {
  if (!round) return null
  const mine = new Set(viewerEmails.map(normalize).filter(Boolean))
  if (mine.size === 0) return null
  for (const side of ["aff", "neg"] as const) {
    const debaters = round.debaters?.[side] ?? []
    for (let index = 0; index < debaters.length; index++) {
      if (mine.has(normalize(debaters[index]))) return { side, index }
    }
  }
  return null
}

/** Whether the viewer in `seat` gives `speech`. */
export function isViewerSpeech(speech: SpeakerSpeech, seat: ViewerSeat | null): boolean {
  if (!seat) return false
  const code = (speech.speaker ?? "").toUpperCase()
  const side = code.includes("N") ? "neg" : code.includes("A") ? "aff" : speech.secondary ? "neg" : "aff"
  if (side !== seat.side) return false
  const digit = code.match(/[12]/)?.[0]
  return digit ? Number(digit) - 1 === seat.index : true
}

/**
 * The email of the debater who gives `speech` — the same side/slot rule as
 * {@link isViewerSpeech}. A code with no digit (LD) takes the side's first
 * debater. Empty string when the round has no one seated there.
 */
export function speechSpeakerEmail(round: Round | null | undefined, speech: SpeakerSpeech): string {
  if (!round) return ""
  const code = (speech.speaker ?? "").toUpperCase()
  const side = code.includes("N") ? "neg" : code.includes("A") ? "aff" : speech.secondary ? "neg" : "aff"
  const digit = code.match(/[12]/)?.[0]
  return (round.debaters?.[side]?.[digit ? Number(digit) - 1 : 0] ?? "").trim()
}
