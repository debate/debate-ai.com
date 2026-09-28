/**
 * @fileoverview How webcam-room participants are labeled on their video
 * tiles: by the role they joined as (debater / judge / observer) and, for
 * everyone other than you, as "Virtual" — they're in the round remotely, so
 * e.g. a judge who can't be there in person is clearly marked.
 *
 * @module webcam/room-labels
 */

import type { RoomRole } from "./room-protocol"

export const ROOM_ROLE_LABELS: Record<RoomRole, string> = {
  speaker: "Debater",
  judge: "Judge",
  observer: "Observer",
}

/** Tile caption: the participant's name, role, and whether they're in the room remotely. */
export function roomTileLabel(name: string, role: RoomRole, { self = false }: { self?: boolean } = {}): string {
  const who = self ? `${name} (you)` : name
  return `${who} · ${ROOM_ROLE_LABELS[role] ?? ROOM_ROLE_LABELS.speaker}${self ? "" : " · Virtual"}`
}
