import { describe, expect, it } from "vitest"
import {
  buildHeadToHeadNetwork,
  entryKey,
  nodeOpponents,
  parseTournamentRounds,
  sortedEntryName,
} from "../src/leaderboard/network/headToHeadNetwork"
import { loadHeadToHeadRounds } from "../src/leaderboard/network/loadHeadToHeadRounds"
import { loadRankingDataset } from "../src/upstream"
import type { RankingEntry } from "../src/types"

function entry(rank: number, school: string, name: string): RankingEntry {
  return {
    rank,
    school,
    name,
    adjustedRating: 2000 - rank * 10,
    deviation: 50,
    matches: 10,
    rating: 2100 - rank * 10,
    hash: `${school}${name}`,
    affWinRate: null,
    negWinRate: null,
    affElimWinRate: null,
    negElimWinRate: null,
  }
}

const ENTRIES = `Institution,Location,Entry,Code,Record
Emory,GA/US,Young & Gallagher,Emory GY,
Michigan,MI/US,Shah & Esmailzadeh,Michigan ES,
Kansas,KS/US,Baxter & Terreros,Kansas BT,
`

describe("head-to-head network", () => {
  it("keys entries the way upstream sorts and normalizes names", () => {
    expect(sortedEntryName("young & gallagher", false)).toBe("Gallagher & Young")
    expect(entryKey("Emory", "Young & Gallagher")).toBe(entryKey("Emory ", "Gallagher & Young"))
    expect(sortedEntryName("arnav dwivedi", true)).toBe("Arnav Dwivedi")
  })

  it("parses rounds, skipping byes and undecided rounds, and spots elims", () => {
    const rounds = parseTournamentRounds(
      {
        slug: "t",
        entries: ENTRIES,
        rounds: [
          { file: "01-round-1.csv", text: "Aff,Neg,Judge,Win\nEmory GY,Michigan ES,J,Neg\nKansas BT,BYE,,Aff\nEmory GY,Kansas BT,J,\n" },
          { file: "Tabroom-9.csv", text: "Aff,Neg,Judges,Votes,Win\nEmory GY,Kansas BT,\"A B C\",\"Aff Aff Neg\",Aff\n" },
          { file: "10-octas.csv", text: "Pro,Con,Judge,Win\nMichigan ES,Kansas BT,J,Con\n" },
        ],
      },
      false,
    )
    expect(rounds).toHaveLength(3)
    expect(rounds[0]).toMatchObject({ elim: false, winner: entryKey("Michigan", "Esmailzadeh & Shah") })
    expect(rounds[1].elim).toBe(true)
    expect(rounds[2]).toMatchObject({ elim: true, winner: entryKey("Kansas", "Baxter & Terreros") })
  })

  it("links ranked entries by their rounds and drops the unlinked", () => {
    const entries = [
      entry(1, "Emory", "Gallagher & Young"),
      entry(2, "Michigan", "Esmailzadeh & Shah"),
      entry(3, "Kansas", "Baxter & Terreros"),
      entry(4, "Loner", "A & B"),
    ]
    const k = (e: RankingEntry) => entryKey(e.school, e.name)
    const [a, b, c] = entries.map(k)
    const rounds = [
      { aff: a, neg: b, winner: b, tournament: "t", elim: false },
      { aff: b, neg: a, winner: a, tournament: "t", elim: true },
      { aff: a, neg: c, winner: a, tournament: "t", elim: false },
    ]
    const network = buildHeadToHeadNetwork(entries, rounds, { width: 400, height: 300, iterations: 50 })
    expect(network.nodes.map((n) => n.entry.rank)).toEqual([1, 2, 3])
    expect(network.links).toEqual([
      { source: 0, target: 1, rounds: 2, sourceWins: 1, targetWins: 1, elims: 1 },
      { source: 0, target: 2, rounds: 1, sourceWins: 1, targetWins: 0, elims: 0 },
    ])
    expect(network.nodes[0].neighbors).toEqual([1, 2])
    expect(nodeOpponents(network, 2)).toMatchObject([{ wins: 0, losses: 1, rounds: 1 }])
    for (const node of network.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0)
      expect(node.x).toBeLessThanOrEqual(400)
      expect(node.y).toBeGreaterThanOrEqual(0)
      expect(node.y).toBeLessThanOrEqual(300)
    }
    // Deterministic: the same data lays out the same way.
    const again = buildHeadToHeadNetwork(entries, rounds, { width: 400, height: 300, iterations: 50 })
    expect(again.nodes.map((n) => [n.x, n.y])).toEqual(network.nodes.map((n) => [n.x, n.y]))
  })

  it("builds a connected picture from this season's college ballots", async () => {
    const [rounds, dataset] = await Promise.all([loadHeadToHeadRounds("cpd"), loadRankingDataset("cpd")])
    if (!rounds.length) return // submodule not checked out
    const network = buildHeadToHeadNetwork(dataset.entries, rounds)
    expect(network.nodes.length).toBeGreaterThan(40)
    expect(network.links.length).toBeGreaterThan(network.nodes.length)
  })
})
