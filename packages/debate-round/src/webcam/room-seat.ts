/**
 * @fileoverview Works out where the viewer sits in a round's webcam room from
 * the round's invite list, so nobody has to pick "debater / judge / observer"
 * by hand.
 *
 * A round's `debaters.aff` / `debaters.neg` pairs and its `judges` list hold
 * the invited participants — usually emails (see `round/round-participants.ts`),
 * sometimes plain names typed into the Round Editor. The viewer is matched by
 * their signed-in email (and "My Team" email), or by display name against an
 * entry that isn't an email. A match gives a seat code — 1A / 2A / 1N / 2N for
 * the debaters in speaker order, 1J / 2J / … for the judges — and anyone not on
 * the invite joins as an unlabeled spectator.
 *
 * @module webcam/room-seat
 */

import type { Round } from "../types/flow"
import type { RoomRole, RoomSeat } from "./room-protocol"

export interface InferredRoomSeat {
  role: RoomRole
  /** Null for a spectator — they get no seat label. */
  seat: RoomSeat | null
}

const normalize = (value: string | null | undefined) => (value ?? "").trim().toLowerCase().replace(/\s+/g, " ")

/**
 * The viewer's role and seat in `round`: debaters first (in case someone is
 * listed twice), then judges. Unmatched viewers — or no round — are spectators.
 */
export function inferRoomSeat(
  round: Pick<Round, "debaters" | "judges"> | null | undefined,
  viewerEmails: readonly (string | null | undefined)[],
  viewerName?: string | null,
): InferredRoomSeat {
  const spectator: InferredRoomSeat = { role: "observer", seat: null }
  if (!round) return spectator
  const emails = new Set(viewerEmails.map(normalize).filter(Boolean))
  const name = normalize(viewerName)
  const matches = (entry: string | null | undefined) => {
    const value = normalize(entry)
    if (!value) return false
    return value.includes("@") ? emails.has(value) : value === name
  }

  for (const [side, letter] of [["aff", "A"], ["neg", "N"]] as const) {
    const debaters = round.debaters?.[side] ?? []
    for (let i = 0; i < debaters.length && i < 2; i++) {
      if (matches(debaters[i])) return { role: "speaker", seat: `${i + 1}${letter}` }
    }
  }
  const judges = round.judges ?? []
  for (let i = 0; i < judges.length && i < 99; i++) {
    if (matches(judges[i])) return { role: "judge", seat: `${i + 1}J` }
  }
  return spectator
}
