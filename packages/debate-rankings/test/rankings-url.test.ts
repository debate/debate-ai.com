import { describe, expect, it } from "vitest"

import {
  canonicalRankingsHref,
  rankingsFormatFromPath,
  rankingsHref,
} from "../src/leaderboard/rankingsUrl"

describe("rankingsHref", () => {
  it("puts the format in the path and keeps the rest of the query", () => {
    expect(rankingsHref("VCX", "season=all-time")).toBe("/rank/VCX?season=all-time")
    expect(rankingsHref("ndt", new URLSearchParams("format=VPF&by=schools"))).toBe("/rank/NDT?by=schools")
    expect(rankingsHref(null)).toBe("/rank")
  })
})

describe("rankingsFormatFromPath", () => {
  it("reads the format segment, upper-cased", () => {
    expect(rankingsFormatFromPath("/rank/vcx")).toBe("VCX")
    expect(rankingsFormatFromPath("/rank/PARLI/")).toBe("PARLI")
    expect(rankingsFormatFromPath("/rank")).toBeNull()
    expect(rankingsFormatFromPath("/coaching/rankings")).toBeNull()
    expect(rankingsFormatFromPath("/rank/%E0%A4%A")).toBeNull()
    expect(rankingsFormatFromPath(null)).toBeNull()
  })
})

describe("canonicalRankingsHref", () => {
  it("moves old addresses onto /rank/<format>", () => {
    expect(canonicalRankingsHref("/coaching/rankings", "?format=VCX&season=all-time")).toBe(
      "/rank/VCX?season=all-time",
    )
    expect(canonicalRankingsHref("/practice/rankings", "")).toBe("/rank")
  })

  it("returns null for an address that is already canonical", () => {
    expect(canonicalRankingsHref("/rank/VCX", "?season=all-time")).toBeNull()
    expect(canonicalRankingsHref("/rank", "")).toBeNull()
    expect(canonicalRankingsHref("/rankings", "?format=VCX")).toBeNull()
  })
})
