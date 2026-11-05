import { describe, expect, it } from "vitest"
import { findFlowSpeechDoc } from "../src/round/round-speech-docs"

describe("findFlowSpeechDoc", () => {
  const aff = { id: 1, roundId: 9, speechDocs: { "1AC": "# Plan", "1NC": "  " } }
  const neg = { id: 2, roundId: 9, speechDocs: { "1nc": "# Off 1" } }
  const other = { id: 3, roundId: 4, speechDocs: { "2AC": "# Elsewhere" } }

  it("prefers the selected flow's doc", () => {
    expect(findFlowSpeechDoc([aff, neg], aff, "1AC")).toBe("# Plan")
  })

  it("falls back to the round's other flows, ignoring blank docs and case", () => {
    expect(findFlowSpeechDoc([aff, neg, other], aff, "1NC")).toBe("# Off 1")
    expect(findFlowSpeechDoc([aff, neg, other], aff, "2AC")).toBeNull()
    expect(findFlowSpeechDoc([aff], null, "1AC")).toBeNull()
  })
})
