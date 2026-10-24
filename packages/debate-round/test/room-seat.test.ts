import { describe, expect, it } from "vitest"
import { inferRoomSeat } from "../src/webcam/room-seat"
import { normalizeSeat } from "../src/webcam/room-protocol"

const round = {
  debaters: { aff: ["a1@x.com", "A2@x.com"] as [string, string], neg: ["n1@x.com", "Nina Neg"] as [string, string] },
  judges: ["j1@x.com", "j2@x.com", "j3@x.com"],
}

describe("inferRoomSeat", () => {
  it("seats debaters by side and speaker order", () => {
    expect(inferRoomSeat(round, ["a1@x.com"])).toEqual({ role: "speaker", seat: "1A" })
    expect(inferRoomSeat(round, [" a2@X.com "])).toEqual({ role: "speaker", seat: "2A" })
    expect(inferRoomSeat(round, ["n1@x.com"])).toEqual({ role: "speaker", seat: "1N" })
  })

  it("matches a name entry against the viewer's display name", () => {
    expect(inferRoomSeat(round, ["other@x.com"], "nina  neg")).toEqual({ role: "speaker", seat: "2N" })
  })

  it("numbers judges in invite order", () => {
    expect(inferRoomSeat(round, [null, "j3@x.com"])).toEqual({ role: "judge", seat: "3J" })
  })

  it("makes everyone else an unlabeled spectator", () => {
    expect(inferRoomSeat(round, ["stranger@x.com"], "Stranger")).toEqual({ role: "observer", seat: null })
    expect(inferRoomSeat(round, [])).toEqual({ role: "observer", seat: null })
    expect(inferRoomSeat(null, ["a1@x.com"])).toEqual({ role: "observer", seat: null })
  })

  it("doesn't let a blank name match blank invite slots", () => {
    const ld = { debaters: { aff: ["a@x.com", ""] as [string, string], neg: ["n@x.com", ""] as [string, string] }, judges: [] }
    expect(inferRoomSeat(ld, [], "")).toEqual({ role: "observer", seat: null })
  })
})

describe("normalizeSeat", () => {
  it("accepts seat codes and rejects anything else", () => {
    expect(normalizeSeat("1a")).toBe("1A")
    expect(normalizeSeat("12J")).toBe("12J")
    expect(normalizeSeat("3A")).toBeUndefined()
    expect(normalizeSeat("<b>")).toBeUndefined()
    expect(normalizeSeat(null)).toBeUndefined()
  })
})
