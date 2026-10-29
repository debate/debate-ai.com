import { describe, expect, it, vi } from "vitest"
import type { CollegeHistoryEntry, RankingDataset, RankingDatasetId, RankingEntry } from "@debate-ai/rankings"

import { createJudgeParadigmLookup, createTeamRatingLookup } from "../../../src/lib/tournaments/enrichment"

const row = (overrides: Partial<RankingEntry>) => ({ rank: 1, school: "", name: "", rating: 80, ...overrides }) as RankingEntry
const datasets: Partial<Record<RankingDatasetId, RankingEntry[]>> = {
  hspf: [row({ rank: 2, school: "Harker", name: "Le & Luo", rating: 91.25 })],
  hscx: [row({ rank: 5, school: "Greenhill", name: "Abe & Bo" })],
  cpd: [row({ rank: 1, school: "Michigan", name: "Barrett & Song" }), row({ rank: 9, school: "Greenhill", name: "Abe & Bo" })],
}
const load = vi.fn(async (id: RankingDatasetId) => ({ id, entries: datasets[id] ?? [] }) as unknown as RankingDataset)

describe("createTeamRatingLookup", () => {
  const lookup = createTeamRatingLookup(load)

  it("finds an entry in its own format's rankings, with names, rating and logo", async () => {
    const team = await lookup({ code: "Harker LL", event: { name: "Varsity Public Forum", abbr: "VPF" } })
    expect(team).toMatchObject({ names: "Le & Luo", rating: 91.25, rank: 2, school: "Harker", rankingLabel: "HS Public Forum" })
    expect(team?.logoSrc).toBeTruthy()
  })

  it("does not look a PF team up in another format", async () => {
    expect(await lookup({ code: "Harker LL", event: { name: "Lincoln Douglas", abbr: "LD" } })).toBeNull()
  })

  it("checks both policy rankings and leaves a team found in both unmatched", async () => {
    expect(await lookup({ code: "Michigan BS", event: { name: "Open", abbr: "CX-O" } })).toMatchObject({ rankingLabel: "College Policy" })
    expect(await lookup({ code: "Greenhill AB", event: { name: "Open", abbr: "CX-O" } })).toBeNull()
  })

  it("loads each dataset once", async () => {
    const counted = vi.fn(load)
    const once = createTeamRatingLookup(counted)
    await once({ code: "Harker LL", event: { abbr: "PF" } })
    await once({ code: "Harker LL", event: { abbr: "PF" } })
    expect(counted).toHaveBeenCalledTimes(1)
  })
})

describe("createTeamRatingLookup for a past season", () => {
  const past: CollegeHistoryEntry[] = [{ rank: 3, school: "University of Kansas", name: "Katz & Robinson", rating: 43.11, mu: 46.74, sigma: 1.21 }]
  const loadHistory = vi.fn(async (season: number) => (season === 2018 ? past : []))
  const lookup = createTeamRatingLookup(load, loadHistory, () => new Date("2026-10-20T12:00:00Z"))
  const ndt = { name: "NDT Open Policy", abbr: "NDT" }

  it("matches a college entry to that season's table, not the current rankings", async () => {
    const team = await lookup({ code: "Kansas KR", event: ndt, season: 2018 })
    expect(team).toMatchObject({ names: "Katz & Robinson", rank: 3, rating: 43.11, rankingLabel: "2017-18 college policy (debatedata)" })
    expect(await lookup({ code: "Michigan BS", event: ndt, season: 2018 })).toBeNull()
  })

  it("shows nothing for a past season the history does not cover, or an event that may be high school", async () => {
    expect(await lookup({ code: "Harker LL", event: { abbr: "PF" }, season: 2018 })).toBeNull()
    expect(await lookup({ code: "Kansas KR", event: { name: "Open", abbr: "CX-O" }, season: 2018 })).toBeNull()
    expect(await lookup({ code: "Kansas KR", event: ndt, season: 2005 })).toBeNull()
  })

  it("uses the current rankings for a tournament this season", async () => {
    expect(await lookup({ code: "Michigan BS", event: ndt, season: 2027 })).toMatchObject({ rankingLabel: "College Policy" })
  })
})

describe("createJudgeParadigmLookup", () => {
  it("sends the names asked in one tick as one request, once each", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ "sam lee": 55, "ann yu": null }))
    const lookup = createJudgeParadigmLookup("/api/tabroom-paradigms", fetchImpl as typeof fetch)
    const [a, b, c] = await Promise.all([lookup("Sam", "Lee"), lookup("Ann", "Yu"), lookup("sam", "lee")])
    expect([a, b, c]).toEqual([55, null, 55])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(String((fetchImpl.mock.calls[0] as unknown[])[0])).toBe("/api/tabroom-paradigms?name=Sam%7CLee&name=Ann%7CYu")
    expect(await lookup("Sam", "Lee")).toBe(55)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("answers null when the search fails", async () => {
    const lookup = createJudgeParadigmLookup("/x", (async () => { throw new Error("offline") }) as typeof fetch)
    expect(await lookup("Sam", "Lee")).toBeNull()
  })
})
