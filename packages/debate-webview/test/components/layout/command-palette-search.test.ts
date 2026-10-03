import { describe, expect, it } from "vitest"
import {
  createPaletteIndex,
  highlightRanges,
  mergeRanges,
  searchPalette,
  splitByRanges,
  type PaletteEntry,
} from "../../../src/components/layout/command-palette-search"

const entry = (href: string, label: string, description: string, group = "Tools", highlights?: string[]): PaletteEntry<null> => ({
  href,
  label,
  description,
  group,
  highlights,
  data: null,
})

const ENTRIES = [
  entry("/research", "Research Workspace", "Topic coverage, the evidence library, and peer review."),
  entry("/judge", "AI Judge", "Get a decision on a practice round."),
  entry("/timer", "Speech Timer", "Prep and speech timers for every format.", "Rounds", ["Works offline"]),
  entry("/settings", "Settings", "Editor settings including research defaults.", "Go to"),
  entry("/prep", "Prep Room", "Shared team prep with a task inbox."),
]

const hrefs = (q: string) => searchPalette(createPaletteIndex(ENTRIES), q).map((r) => r.entry.href)

describe("searchPalette", () => {
  it("returns nothing for an empty query (the palette shows its browse view)", () => {
    expect(hrefs("   ")).toEqual([])
  })

  it("puts a label hit ahead of a description-only hit", () => {
    expect(hrefs("research")[0]).toBe("/research")
    expect(hrefs("research")).toContain("/settings")
  })

  it("tolerates typos and dropped letters", () => {
    expect(hrefs("reserch")[0]).toBe("/research")
    expect(hrefs("timr")[0]).toBe("/timer")
  })

  it("matches on highlights the label doesn't carry", () => {
    expect(hrefs("offline")).toContain("/timer")
  })

  it("ranks an exact label above a longer label sharing the prefix", () => {
    expect(hrefs("settings")[0]).toBe("/settings")
  })

  it("matches multi-word queries by word starts", () => {
    expect(hrefs("ai jud")[0]).toBe("/judge")
  })
})

describe("highlightRanges", () => {
  it("highlights each query token where it occurs", () => {
    expect(highlightRanges("AI Judge", "ai jud")).toEqual([[0, 2], [3, 6]])
  })

  it("is case-insensitive and finds repeats", () => {
    expect(highlightRanges("Prep and prep", "PREP")).toEqual([[0, 4], [9, 13]])
  })

  it("prefers word-start hits over mid-word ones", () => {
    expect(highlightRanges("Debate against an AI", "ai")).toEqual([[18, 20]])
    expect(highlightRanges("Explain things", "lain")).toEqual([[3, 7]])
  })

  it("falls back to fuse's fuzzy indices, bridging one-letter gaps", () => {
    expect(highlightRanges("Research", "reserch", { indices: [[0, 3], [5, 7]], key: "label" })).toEqual([[0, 8]])
    expect(highlightRanges("Research", "rsch", { indices: [[0, 0], [4, 7]], key: "label" })).toEqual([[0, 1], [4, 8]])
  })

  it("doesn't mix fuzzy indices in once a token matched outright", () => {
    expect(highlightRanges("and judge", "ai jud", { indices: [[2, 6]], key: "description" })).toEqual([[4, 7]])
  })
})

describe("mergeRanges / splitByRanges", () => {
  it("merges overlapping and adjacent ranges", () => {
    expect(mergeRanges([[4, 6], [0, 2], [2, 3], [5, 8]])).toEqual([[0, 3], [4, 8]])
  })

  it("splits text into plain and matched segments", () => {
    expect(splitByRanges("Speech Timer", [[7, 12]])).toEqual([
      { text: "Speech ", match: false },
      { text: "Timer", match: true },
    ])
  })
})
