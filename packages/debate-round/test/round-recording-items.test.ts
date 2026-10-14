import { describe, expect, it } from "vitest"
import { roundRecordingFor } from "../src/round/round-recording-items"

describe("roundRecordingFor", () => {
  it("lists the round's speeches without cross-ex", () => {
    const result = roundRecordingFor({ id: 7 }, [{ name: "1AC" }, { name: "CX" }, { name: "1NC" }, { name: "CX" }])
    expect(result).toEqual({
      roundId: "7",
      items: [
        { key: "1AC", label: "1AC" },
        { key: "1NC", label: "1NC" },
      ],
    })
    expect(roundRecordingFor(undefined, []).roundId).toBe("practice")
  })
})
