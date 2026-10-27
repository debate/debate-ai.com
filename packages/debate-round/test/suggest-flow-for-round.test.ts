import { describe, expect, it } from "vitest"
import { suggestFlowForRound } from "../src/flow/suggest-flow-for-round"

const flows = [
  { clientId: 1, label: "Blake Semis vs Westlake" },
  { clientId: 2, label: "Harvard Octas" },
  { clientId: 3, label: "Blake Finals" },
]

describe("suggestFlowForRound", () => {
  it("returns the one flow whose label mentions the tournament, ignoring case", () => {
    expect(suggestFlowForRound(flows, " harvard ")).toEqual(flows[1])
  })

  it("returns null when several flows match", () => {
    expect(suggestFlowForRound(flows, "Blake")).toBeNull()
  })

  it("returns null when none match", () => {
    expect(suggestFlowForRound(flows, "Yale")).toBeNull()
  })

  it("ignores names too short to be meaningful", () => {
    expect(suggestFlowForRound(flows, "Ha")).toBeNull()
    expect(suggestFlowForRound(flows, "  ")).toBeNull()
  })
})
