import { describe, expect, it } from "vitest"
import {
  countFlowWordsForSide,
  countWords,
  sideKeyForLoggedSide,
} from "../src/flow/flow-word-count"
import type { Box } from "../src/types/flow"

const COLUMNS = ["1AC", "1NC", "2AC", "2NC"]

function row(contents: string[], overrides: Partial<Box> = {}): Box {
  let box: Box | undefined
  for (let i = contents.length - 1; i >= 0; i--) {
    box = {
      content: contents[i],
      children: box ? [box] : [],
      index: 0,
      level: i + 1,
      focus: false,
      empty: !contents[i].trim(),
    }
  }
  return { ...(box as Box), ...overrides }
}

describe("countWords", () => {
  it("splits on any whitespace and ignores blanks", () => {
    expect(countWords("  one two\nthree\t four ")).toBe(4)
    expect(countWords("   ")).toBe(0)
    expect(countWords("")).toBe(0)
  })
})

describe("sideKeyForLoggedSide", () => {
  it("maps aff/neg to the first/second side key in column order", () => {
    expect(sideKeyForLoggedSide({ columns: COLUMNS }, "aff")).toBe("A")
    expect(sideKeyForLoggedSide({ columns: COLUMNS }, "neg")).toBe("N")
  })

  it("returns null when the flow has no second side", () => {
    expect(sideKeyForLoggedSide({ columns: ["1AC", "2AC"] }, "neg")).toBeNull()
  })
})

describe("countFlowWordsForSide", () => {
  const flow = {
    columns: COLUMNS,
    children: [
      row(["tariffs hurt trade", "no they do not", "yes they do hurt", ""]),
      row(["second contention here", "", "", "answer"]),
    ],
  }

  it("counts only the requested side's columns", () => {
    expect(countFlowWordsForSide(flow, "aff")).toBe(3 + 4 + 3)
    expect(countFlowWordsForSide(flow, "neg")).toBe(4 + 1)
  })

  it("returns 0 for an empty flow that still has both sides", () => {
    expect(countFlowWordsForSide({ columns: COLUMNS, children: [] }, "aff")).toBe(0)
  })

  it("returns null when the logged side has no column", () => {
    expect(countFlowWordsForSide({ columns: ["1AC"], children: [row(["a b"])] }, "neg")).toBeNull()
  })
})
