import { describe, expect, it } from "vitest"
import {
  buildParliRecordSheets,
  matchEntryCodes,
  parliTeamId,
  parliTeamLabel,
  splitEntryCode,
} from "../src/leaderboard/network/parliRecordSheets"
import type { ParliPairing, ParliRoundsSeason } from "../src/sync/parli-tabroom-rounds"
import type { NpdlRankingRow } from "../src/sync/sync-npdl-rankings"

const row = (rank: number, school: string, debater1: string, debater2: string): NpdlRankingRow => ({
  rank,
  school,
  region: null,
  debater1,
  debater2,
  points: 60 - rank,
})

const ROWS = [
  row(1, "Carlmont", "Chien", "Suto"),
  row(2, "Nueva", "Asudani", "Wee"),
  row(3, "Independent", "Ordukhanyan", "Ratchman"),
  row(4, "Menlo-Atherton", "T. Greenleaf", "Kassayan"),
  row(5, "Albany", "Bollin-Small", "Brizzi"),
  row(6, "Nueva", "Wong", "Aguilar"),
  row(7, "Piedmont", "Nobody", "Played"),
]

const p = (gov: string, opp: string, extra: Partial<ParliPairing> = {}): ParliPairing => ({ gov, opp, judges: ["Zach Berg"], ...extra })

const DATA: ParliRoundsSeason = {
  season: "2026-27",
  circuitId: 179,
  fetchedAt: "2026-11-27T00:00:00.000Z",
  results: "public",
  skipped: [],
  tournaments: [
    {
      id: "2",
      name: "Later Open",
      start: "2026-11-14",
      end: "2026-11-15",
      location: "CA",
      events: [
        {
          id: "20",
          name: "Open Parli",
          rounds: [
            { id: "200", label: "Quarters", elim: true, pairings: [p("Nueva AW", "Albany Bollin-Small & Brizzi", { winner: "gov", resultSource: "advancement" })] },
          ],
        },
      ],
    },
    {
      id: "1",
      name: "Earlier Open",
      start: "2026-09-26",
      end: "2026-09-26",
      location: "CA",
      events: [
        {
          id: "10",
          name: "Open Parli",
          rounds: [
            { id: "100", label: "Round 1", elim: false, pairings: [p("Carlmont SC", "Nueva AW"), p("Nueva AW", "Carlmont CS", { winner: "opp", votes: "2-1", resultSource: "ballots" })] },
            { id: "101", label: "Round 2", elim: false, pairings: [p("Menlo GK", "Albany BB"), p("Madison Ordukhanyan & Ratchman", "Nueva ZZ")] },
          ],
        },
      ],
    },
  ],
}

describe("entry codes", () => {
  it("splits school and initials, or school and spelled-out last names", () => {
    expect(splitEntryCode("Nueva AW")).toEqual({ school: "Nueva", initials: "AW" })
    expect(splitEntryCode("Palo Alto Greenberg & Cai")).toEqual({ school: "Palo Alto", initials: "GC", lastNames: ["Greenberg", "Cai"] })
    expect(splitEntryCode("Berkeley/Menlo SD")).toEqual({ school: "Berkeley/Menlo", initials: "SD" })
    expect(splitEntryCode("Just a name")).toBeNull()
  })

  it("matches by school and last-name initials, either order, hyphens and first initials handled", () => {
    const m = matchEntryCodes(ROWS, ["Carlmont SC", "Carlmont CS", "Menlo GK", "Menlo-Atherton KG", "Albany BB", "Albany SB", "Nueva AW", "Nueva XX"])
    expect(m.get("Carlmont SC")).toBe(ROWS[0])
    expect(m.get("Carlmont CS")).toBe(ROWS[0])
    expect(m.get("Menlo GK")).toBe(ROWS[3])
    expect(m.get("Menlo-Atherton KG")).toBe(ROWS[3])
    expect(m.get("Albany BB")).toBe(ROWS[4])
    expect(m.get("Albany SB")).toBe(ROWS[4])
    expect(m.get("Nueva AW")).toBe(ROWS[1])
    expect(m.has("Nueva XX")).toBe(false)
  })

  it("matches a code that spells out both last names whatever school it lists", () => {
    const m = matchEntryCodes(ROWS, ["Madison Ordukhanyan & Ratchman"])
    expect(m.get("Madison Ordukhanyan & Ratchman")).toBe(ROWS[2])
  })

  it("leaves a code unmatched when two ranked teams could own it and the order does not settle it", () => {
    const clash = [row(1, "Nueva", "Alpha", "Wee"), row(2, "Nueva", "Wee", "Alpha")]
    const m = matchEntryCodes(clash, ["Nueva AW", "Nueva WA"])
    expect(m.get("Nueva AW")).toBe(clash[0])
    expect(m.get("Nueva WA")).toBe(clash[1])
    const ambiguous = [row(1, "Nueva", "Alpha", "Wee"), row(2, "Nueva", "Alpha", "Wu")]
    expect(matchEntryCodes(ambiguous, ["Nueva AW"]).size).toBe(0)
  })
})

describe("record sheets", () => {
  const result = buildParliRecordSheets(ROWS, DATA, 6)

  it("builds a sheet per top team with rounds, oldest first", () => {
    expect(result.sheets.map((s) => s.team.rank)).toEqual([1, 2, 3, 4, 5])
    const nueva = result.sheets.find((s) => s.team.rank === 2)!
    expect(nueva.rounds.map((r) => [r.tournament, r.round, r.side, r.opponentCode])).toEqual([
      ["Earlier Open", "Round 1", "Opp", "Carlmont SC"],
      ["Earlier Open", "Round 1", "Gov", "Carlmont CS"],
      ["Later Open", "Quarters", "Gov", "Albany Bollin-Small & Brizzi"],
    ])
  })

  it("counts W-L from known results and sets the rest aside", () => {
    const nueva = result.sheets.find((s) => s.team.rank === 2)!
    expect(nueva).toMatchObject({ wins: 1, losses: 1, unknown: 1 })
    expect(nueva.rounds[1]).toMatchObject({ result: "L", votes: "2-1", resultSource: "ballots" })
    expect(nueva.rounds[2]).toMatchObject({ result: "W", resultSource: "advancement" })
    expect(nueva.rounds[0].result).toBeNull()
    const albany = result.sheets.find((s) => s.team.rank === 5)!
    expect(albany).toMatchObject({ wins: 0, losses: 1, unknown: 1 })
  })

  it("links opponents that are themselves ranked, and gives the judging panel", () => {
    const carlmont = result.sheets[0]
    expect(carlmont.rounds[0].opponent).toBe(ROWS[1])
    expect(carlmont.rounds[0].judges).toEqual(["Zach Berg"])
    expect(carlmont.codes).toEqual(["Carlmont SC", "Carlmont CS"])
    const unranked = buildParliRecordSheets(ROWS, DATA, 6).sheets.find((s) => s.team.rank === 3)!
    expect(unranked.rounds[0].opponent).toBeNull()
  })

  it("reports top teams with no rounds, and the source totals", () => {
    expect(result.unmatched).toEqual([ROWS[5]])
    expect(result.tournaments).toBe(2)
    expect(result.pairings).toBe(5)
    expect(result.fullResults).toBe(false)
    expect(buildParliRecordSheets(ROWS, { ...DATA, results: "ballots" }).fullResults).toBe(true)
  })

  it("limits to the best-ranked teams and copes with no tournaments", () => {
    expect(buildParliRecordSheets(ROWS, DATA, 2).sheets.map((s) => s.team.rank)).toEqual([1, 2])
    const empty = buildParliRecordSheets(ROWS, { ...DATA, tournaments: [] }, 3)
    expect(empty.sheets).toEqual([])
    expect(empty.unmatched).toHaveLength(3)
  })

  it("labels and ids teams", () => {
    expect(parliTeamLabel(ROWS[1])).toBe("Nueva Asudani & Wee")
    expect(parliTeamId(ROWS[3])).toBe("parli-sheet-4-menlo-atherton-t-greenleaf-kassayan")
  })
})
