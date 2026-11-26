/**
 * @fileoverview The server-side lookup behind a watch page's title: which
 * rankings can speak for a round's teams (the current season's, a past
 * college season's table, or none) and each team's rank in them.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import type { RankingDataset, RankingEntry } from "@debate-ai/rankings"
import type { VideoType } from "../src/types/videos"

const loaders = vi.hoisted(() => ({
  loadCollegeHistory: vi.fn(),
  loadRankingDataset: vi.fn(),
}))

vi.mock("@debate-ai/rankings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@debate-ai/rankings")>()),
  loadCollegeHistory: loaders.loadCollegeHistory,
  loadRankingDataset: loaders.loadRankingDataset,
}))

const { isRankedSeasonRound, loadVideoTeamRanks, pastCollegeSeason, pastHsSeason } = await import(
  "../src/lib/video-team-ranks"
)

/** Spring 2026, so the current season is 2026 and 2025 is "past". */
const NOW = new Date(2026, 2, 1)

const CX = 1
const PF = 2
const COLLEGE = 4

function round(style: number | string | undefined, aff: string | null, neg: string | null, season?: number, date = "2026-02-10"): VideoType {
  const video: VideoType = ["id", "Round", date, "Channel", 10, "", style, "Tournament", "Finals", aff, neg]
  if (season !== undefined) video[17] = season
  return video
}

function entry(rank: number, school: string, name: string): RankingEntry {
  return {
    rank,
    school,
    name,
    adjustedRating: 70,
    deviation: 3,
    matches: 20,
    rating: 80,
    hash: `${school}-${name}`,
    affWinRate: 50,
    negWinRate: 50,
    affElimWinRate: null,
    negElimWinRate: null,
  }
}

function dataset(id: RankingDataset["id"], entries: RankingEntry[]): RankingDataset {
  return { id, label: id, tournaments: [], majors: [], entries, field: null }
}

beforeEach(() => {
  loaders.loadCollegeHistory.mockReset()
  loaders.loadRankingDataset.mockReset()
})

describe("isRankedSeasonRound", () => {
  it("is true for a ranked-style round from the current season", () => {
    expect(isRankedSeasonRound(round(CX, "A", "B", 2026), NOW)).toBe(true)
  })

  it("is false for a past season, a lecture, or an unranked style", () => {
    expect(isRankedSeasonRound(round(CX, "A", "B", 2025), NOW)).toBe(false)
    expect(isRankedSeasonRound(round("Topic Lectures", "A", "B", 2026), NOW)).toBe(false)
    expect(isRankedSeasonRound(round(9, "A", "B", 2026), NOW)).toBe(false)
  })
})

describe("pastCollegeSeason", () => {
  it("names a past college season from the tuple's season year", () => {
    expect(pastCollegeSeason(round(COLLEGE, "A", "B", 2024), NOW)).toBe(2024)
  })

  it("falls back to the publish date's season when the tuple has none", () => {
    expect(pastCollegeSeason(round(COLLEGE, "A", "B", undefined, "2024-11-02"), NOW)).toBe(2025)
  })

  it("is null for the current season, non-college styles, seasons before the history, and undated rounds", () => {
    expect(pastCollegeSeason(round(COLLEGE, "A", "B", 2026), NOW)).toBeNull()
    expect(pastCollegeSeason(round(CX, "A", "B", 2024), NOW)).toBeNull()
    expect(pastCollegeSeason(round(COLLEGE, "A", "B", 2005), NOW)).toBeNull()
    expect(pastCollegeSeason(round(COLLEGE, "A", "B", undefined, ""), NOW)).toBeNull()
  })
})

describe("pastHsSeason", () => {
  it("names a past high school season with Extinction rankings", () => {
    expect(pastHsSeason(round(PF, "A", "B", 2024), NOW)).toBe(2024)
  })

  it("is null for college, the current season, a missing season or a season before 2016", () => {
    expect(pastHsSeason(round(COLLEGE, "A", "B", 2024), NOW)).toBeNull()
    expect(pastHsSeason(round(PF, "A", "B", 2026), NOW)).toBeNull()
    expect(pastHsSeason(round(PF, "A", "B"), NOW)).toBeNull()
    expect(pastHsSeason(round(PF, "A", "B", 2010), NOW)).toBeNull()
    expect(pastHsSeason(round("Lecture", "A", "B", 2024), NOW)).toBeNull()
  })
})

describe("loadVideoTeamRanks", () => {
  it("returns nothing for a round with no team labels, without loading a table", async () => {
    expect(await loadVideoTeamRanks(round(CX, " ", null, 2026), NOW)).toEqual({})
    expect(loaders.loadRankingDataset).not.toHaveBeenCalled()
  })

  it("ranks each team in the current season's dataset", async () => {
    loaders.loadRankingDataset.mockResolvedValue(
      dataset("hscx", [entry(3, "Harker", "Kim & Park"), entry(9, "Lexington", "Ng & Roy")]),
    )
    const ranks = await loadVideoTeamRanks(round(CX, "Harker KP", "Lexington NR", 2026), NOW)
    expect(loaders.loadRankingDataset).toHaveBeenCalledWith("hscx")
    expect(ranks).toEqual({ aff: 3, neg: 9 })
  })

  it("gives an unknown team a null rank", async () => {
    loaders.loadRankingDataset.mockResolvedValue(dataset("hscx", [entry(3, "Harker", "Kim & Park")]))
    expect(await loadVideoTeamRanks(round(CX, "Harker KP", "Nowhere ZZ", 2026), NOW)).toEqual({ aff: 3, neg: null })
  })

  it("looks a past college round up in its season's table", async () => {
    loaders.loadCollegeHistory.mockResolvedValue([
      { rank: 5, school: "Kansas", name: "Smith & Jones", rating: 1, mu: 2, sigma: 1 },
    ])
    const ranks = await loadVideoTeamRanks(round(COLLEGE, "Kansas SJ", "  ", 2024), NOW)
    expect(loaders.loadCollegeHistory).toHaveBeenCalledWith(2024)
    expect(loaders.loadRankingDataset).not.toHaveBeenCalled()
    expect(ranks).toEqual({ aff: 5, neg: null })
  })

  it("has no ranks for a past high school round or a lecture", async () => {
    expect(await loadVideoTeamRanks(round(PF, "A B", "C D", 2024), NOW)).toEqual({})
    expect(await loadVideoTeamRanks(round("Lecture", "A B", "C D", 2026), NOW)).toEqual({})
    expect(loaders.loadRankingDataset).not.toHaveBeenCalled()
  })

  it("leaves the teams unranked when a table fails to load", async () => {
    loaders.loadRankingDataset.mockRejectedValue(new Error("offline"))
    loaders.loadCollegeHistory.mockRejectedValue(new Error("offline"))
    expect(await loadVideoTeamRanks(round(CX, "Harker KP", "Lexington NR", 2026), NOW)).toEqual({})
    expect(await loadVideoTeamRanks(round(COLLEGE, "Kansas SJ", "Kansas XY", 2024), NOW)).toEqual({})
  })
})
