import { describe, expect, it } from "vitest"
import { stripArgumentLines } from "../src/lib/video-description"

const DESCRIPTION = "1AC: ISS\n2NR: New Advantages Bad, Space Militarization DA\n\nDecision: Neg (Wegmann-Gatarz)"

describe("stripArgumentLines", () => {
  it("drops the 1AC and 2NR lines the team names already show", () => {
    expect(stripArgumentLines(DESCRIPTION, "ISS", "New Advantages Bad, Space Militarization DA")).toBe(
      "Decision: Neg (Wegmann-Gatarz)",
    )
  })

  it("keeps a line whose argument is not recorded", () => {
    expect(stripArgumentLines(DESCRIPTION, "ISS", null)).toBe(
      "2NR: New Advantages Bad, Space Militarization DA\n\nDecision: Neg (Wegmann-Gatarz)",
    )
  })

  it("leaves a description without argument lines alone", () => {
    expect(stripArgumentLines("Just a lecture.", "ISS", "DA")).toBe("Just a lecture.")
  })
})
