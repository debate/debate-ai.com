import { describe, expect, it } from "vitest"
import { parseArgumentTags } from "../src/round/argument-tags"

describe("parseArgumentTags", () => {
  it("splits on commas and trims whitespace", () => {
    expect(parseArgumentTags(" Capitalism K ,Topicality")).toEqual(["Capitalism K", "Topicality"])
  })

  it("drops blanks and case-insensitive duplicates, keeping the first spelling", () => {
    expect(parseArgumentTags("T, , t,Politics,, politics ")).toEqual(["T", "Politics"])
  })

  it("returns an empty list for blank input", () => {
    expect(parseArgumentTags("  ")).toEqual([])
  })
})
