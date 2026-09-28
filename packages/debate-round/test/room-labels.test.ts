import { describe, expect, it } from "vitest"
import { ROOM_ROLE_LABELS, roomTileLabel } from "../src/webcam/room-labels"

describe("roomTileLabel", () => {
  it("marks remote participants as virtual with their role", () => {
    expect(roomTileLabel("Pat", "judge")).toBe("Pat · Judge · Virtual")
    expect(roomTileLabel("Sam", "speaker")).toBe("Sam · Debater · Virtual")
  })

  it("labels your own tile without 'Virtual'", () => {
    expect(roomTileLabel("Me", "observer", { self: true })).toBe("Me (you) · Observer")
  })

  it("has a label for every role", () => {
    expect(Object.keys(ROOM_ROLE_LABELS).sort()).toEqual(["judge", "observer", "speaker"])
  })
})
