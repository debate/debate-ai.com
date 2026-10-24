/**
 * @fileoverview How webcam-room participants are labeled on their video
 * tiles: by the seat inferred from the round invite (1A / 2N / 1J…, see
 * `room-seat.ts`) and, for everyone other than you, as "Virtual" — they're in
 * the round remotely, so e.g. a judge who can't be there in person is clearly
 * marked. Spectators (not on the invite) get no seat badge.
 *
 * @module webcam/room-labels
 */

import type { RoomRole, RoomSeat } from "./room-protocol"

export const ROOM_ROLE_LABELS: Record<RoomRole, string> = {
  speaker: "Debater",
  judge: "Judge",
  observer: "Spectator",
}

/**
 * The tile's badge: the seat code when there is one. A peer on an older client
 * that sent no seat falls back to its debater / judge role; spectators get none.
 */
export function roomBadgeLabel({ role, seat }: { role: RoomRole; seat?: RoomSeat | null }): string | null {
  if (seat) return seat
  return role === "observer" ? null : (ROOM_ROLE_LABELS[role] ?? null)
}

/** Tile caption: the participant's name, seat or role, and whether they're in the room remotely. */
export function roomTileLabel(
  name: string,
  role: RoomRole,
  { self = false, seat }: { self?: boolean; seat?: RoomSeat | null } = {},
): string {
  const who = self ? `${name} (you)` : name
  const where = seat ? (seat.endsWith("J") ? `Judge ${seat}` : seat) : (ROOM_ROLE_LABELS[role] ?? ROOM_ROLE_LABELS.observer)
  return `${who} · ${where}${self ? "" : " · Virtual"}`
}
