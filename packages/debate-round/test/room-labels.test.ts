import { describe, expect, it } from "vitest"
import { ROOM_ROLE_LABELS, roomBadgeLabel, roomTileLabel } from "../src/webcam/room-labels"

describe("roomTileLabel", () => {
  it("marks remote participants as virtual with their role", () => {
    expect(roomTileLabel("Pat", "judge")).toBe("Pat · Judge · Virtual")
    expect(roomTileLabel("Sam", "speaker")).toBe("Sam · Debater · Virtual")
  })

  it("labels your own tile without 'Virtual'", () => {
    expect(roomTileLabel("Me", "observer", { self: true })).toBe("Me (you) · Spectator")
  })

  it("uses the invite seat when there is one", () => {
    expect(roomTileLabel("Sam", "speaker", { seat: "2N" })).toBe("Sam · 2N · Virtual")
    expect(roomTileLabel("Pat", "judge", { seat: "1J" })).toBe("Pat · Judge 1J · Virtual")
  })

  it("has a label for every role", () => {
    expect(Object.keys(ROOM_ROLE_LABELS).sort()).toEqual(["judge", "observer", "speaker"])
  })
})

describe("roomBadgeLabel", () => {
  it("shows the seat, falls back to the role, and leaves spectators unlabeled", () => {
    expect(roomBadgeLabel({ role: "speaker", seat: "1A" })).toBe("1A")
    expect(roomBadgeLabel({ role: "judge" })).toBe("Judge")
    expect(roomBadgeLabel({ role: "observer" })).toBeNull()
  })
})
