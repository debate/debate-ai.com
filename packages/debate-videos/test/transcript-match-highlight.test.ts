/**
 * @fileoverview Splitting transcript text around a search match, so the
 * watch page's transcript search can highlight where a line matched instead
 * of only filtering to lines that contain it.
 */

import { describe, it, expect } from "vitest"
import { splitOnMatch } from "../src/components/transcript/transcriptUtils"

describe("splitOnMatch", () => {
  it("returns the whole text unmatched when there is no needle", () => {
    expect(splitOnMatch("balance of power", "")).toEqual([{ text: "balance of power", matched: false }])
  })

  it("returns the whole text unmatched for a whitespace-only needle", () => {
    expect(splitOnMatch("balance of power", "   ")).toEqual([{ text: "balance of power", matched: false }])
  })

  it("splits out a single match in the middle of the text", () => {
    expect(splitOnMatch("balance of power", "of")).toEqual([
      { text: "balance ", matched: false },
      { text: "of", matched: true },
      { text: " power", matched: false },
    ])
  })

  it("matches case-insensitively but preserves the original casing", () => {
    expect(splitOnMatch("Balance of Power", "POWER")).toEqual([
      { text: "Balance of ", matched: false },
      { text: "Power", matched: true },
    ])
  })

  it("splits out every occurrence, not just the first", () => {
    expect(splitOnMatch("the balance and the power", "the")).toEqual([
      { text: "the", matched: true },
      { text: " balance and ", matched: false },
      { text: "the", matched: true },
      { text: " power", matched: false },
    ])
  })

  it("returns the whole text unmatched when the needle isn't found", () => {
    expect(splitOnMatch("balance of power", "deterrence")).toEqual([
      { text: "balance of power", matched: false },
    ])
  })

  it("matches a whole-text needle as one segment", () => {
    expect(splitOnMatch("power", "power")).toEqual([{ text: "power", matched: true }])
  })

  it("treats regex metacharacters in the needle as literal text", () => {
    expect(splitOnMatch("cost (est.) rising", "(est.)")).toEqual([
      { text: "cost ", matched: false },
      { text: "(est.)", matched: true },
      { text: " rising", matched: false },
    ])
  })
})
