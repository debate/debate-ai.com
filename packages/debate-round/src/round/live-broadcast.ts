/**
 * @fileoverview Who goes on air in a live-streamed round (Round Editor →
 * **Live stream**). Each participant's browser runs its own speech timer, so
 * when a speech starts several devices may be recording; only the speaker's
 * should broadcast, or listeners would hear the same speech twice (once
 * through the opponent's mic across the room).
 *
 * The speaker of a speech comes from the format's `TimerSpeech.speaker`
 * ("1A", "N2", "A", "P1"…); the viewer's seat comes from the invite list
 * (`webcam/room-seat.ts`). Pure functions — the hook that records and uploads
 * is `round/useLiveRoundBroadcast.ts`, and the wire protocol is
 * `@debate-ai/timer`'s `recorder/live-radio.ts`.
 *
 * @module round/live-broadcast
 */

import type { TimerSpeech } from "@debate-ai/timer/src/types"
import type { LiveRoundRegistration } from "@debate-ai/timer/src/recorder/live-radio"
import type { Round } from "../types/flow"
import type { InferredRoomSeat } from "../webcam/room-seat"

/** A debater slot: aff or neg, first or second speaker. */
export interface SpeakerSlot {
  side: "aff" | "neg"
  /** 1-based speaker number. */
  number: number
}

/**
 * Reads a format's speaker code. Aff letters are A (affirmative) and P (pro /
 * proposition); neg letters are N, C (con) and O (opposition). The first digit
 * is the speaker number, 1 when there is none ("A" in LD).
 */
export function parseSpeakerCode(code: string | null | undefined): SpeakerSlot | null {
  const value = (code ?? "").toUpperCase()
  const letter = value.match(/[A-Z]/)?.[0]
  if (!letter) return null
  const side = letter === "A" || letter === "P" ? "aff" : letter === "N" || letter === "C" || letter === "O" ? "neg" : null
  if (!side) return null
  const digit = value.match(/[1-9]/)?.[0]
  return { side, number: digit ? Number(digit) : 1 }
}

/**
 * The slot that gives `speechName` in `speeches` (the round's format), or —
 * when the format doesn't list it — a guess from the name itself ("1AC",
 * "2NR").
 */
export function speakerForSpeech(speechName: string, speeches: readonly TimerSpeech[]): SpeakerSlot | null {
  const upper = speechName.trim().toUpperCase()
  const listed = speeches.find((s) => s.name.toUpperCase() === upper)
  if (listed?.speaker) return parseSpeakerCode(listed.speaker)
  const guess = upper.match(/^([12])([AN])/)
  return guess ? { side: guess[2] === "A" ? "aff" : "neg", number: Number(guess[1]) } : null
}

/** The viewer's seat ("2N") as a slot, or null for a judge or spectator. */
function seatSlot(seat: InferredRoomSeat): SpeakerSlot | null {
  if (seat.role !== "speaker" || !seat.seat) return null
  const match = seat.seat.match(/^([12])([AN])$/)
  return match ? { side: match[2] === "A" ? "aff" : "neg", number: Number(match[1]) } : null
}

const isFilled = (value: string | null | undefined) => !!value && value.trim().length > 0

/**
 * Whether this browser should broadcast `speechName`:
 *
 * - **A debater on the invite** goes on air for their own speeches. When the
 *   speech's slot is empty on the invite (LD has one debater a side), the
 *   side's other debater takes it.
 * - **Anyone else** (judge, spectator) never broadcasts — unless no debater on
 *   the invite is an email, in which case nobody can be matched and the device
 *   running the timer is taken to be the one in the room.
 */
export function shouldBroadcastSpeech(
  round: Pick<Round, "debaters">,
  seat: InferredRoomSeat,
  speechName: string,
  speeches: readonly TimerSpeech[],
): boolean {
  const viewer = seatSlot(seat)
  if (!viewer) {
    const debaters = [...(round.debaters?.aff ?? []), ...(round.debaters?.neg ?? [])]
    return seat.role !== "judge" && !debaters.some((entry) => (entry ?? "").includes("@"))
  }
  const speaker = speakerForSpeech(speechName, speeches)
  if (!speaker || speaker.side !== viewer.side) return false
  const slots = round.debaters?.[speaker.side] ?? []
  let number = Math.min(Math.max(speaker.number, 1), 2)
  if (!isFilled(slots[number - 1])) {
    const other = number === 1 ? 2 : 1
    if (isFilled(slots[other - 1])) number = other
  }
  return viewer.number === number
}

/** The team label a listener sees for a side: the school, else the debaters' typed names (never emails). */
export function liveSideLabel(round: Pick<Round, "debaters" | "schools">, side: "aff" | "neg"): string {
  const school = round.schools?.[side]?.[0]?.trim()
  if (school) return school
  const names = (round.debaters?.[side] ?? [])
    .map((entry) => (entry ?? "").trim())
    // Emails stay private: a listener sees typed names only.
    .filter((entry) => entry && !entry.includes("@"))
  return names.join(" & ") || (side === "aff" ? "Aff" : "Neg")
}

/** What the round tells `/api/live-rounds` when Live stream is switched on or off. */
export function liveRegistrationForRound(
  round: Pick<Round, "slug" | "title" | "tournamentName" | "roundLevel" | "debaters" | "schools" | "judges" | "spectators" | "isPrivate">,
  enabled: boolean,
): LiveRoundRegistration | null {
  if (!round.slug) return null
  const clean = (list: readonly (string | null | undefined)[] | undefined) =>
    (list ?? []).map((entry) => (entry ?? "").trim()).filter(Boolean)
  return {
    slug: round.slug,
    title: round.title || `${round.tournamentName} - ${round.roundLevel}`,
    tournamentName: round.tournamentName,
    roundLevel: round.roundLevel,
    aff: liveSideLabel(round, "aff"),
    neg: liveSideLabel(round, "neg"),
    debaters: clean([...(round.debaters?.aff ?? []), ...(round.debaters?.neg ?? [])]),
    invitees: clean([...(round.judges ?? []), ...(round.spectators ?? [])]),
    isPrivate: !!round.isPrivate,
    enabled,
  }
}
