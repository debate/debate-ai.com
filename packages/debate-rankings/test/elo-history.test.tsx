/**
 * @fileoverview Pins the monthly Elo snapshots' shape: one point per team,
 * keyed by its season-independent slug, and the sparkline that shows nothing
 * until a team has a saved month.
 */

import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  buildEloSnapshot,
  eloHistoryFor,
  eloSnapshotMonth,
  eloTeamKey,
  isEloHistoryDataset,
} from "../src/leaderboard/eloHistory"
import { EloSparkline, eloSparklineLabel } from "../src/leaderboard/profile/EloSparkline"
import type { RankingEntry } from "../src/types"

const entry = (school: string, name: string, rank: number, adjustedRating: number) =>
  ({ school, name, rank, adjustedRating }) as RankingEntry

describe("monthly Elo snapshots", () => {
  it("files a snapshot under its UTC month", () => {
    expect(eloSnapshotMonth(Date.UTC(2026, 11, 1, 6) / 1000)).toBe("2026-12")
    expect(eloSnapshotMonth(Date.UTC(2026, 10, 30, 23, 59) / 1000)).toBe("2026-11")
  })

  it("keeps each team's rating (two decimals) and rank, its better rank when listed twice", () => {
    const teams = buildEloSnapshot([
      entry("Harker", "Lee & Kim", 3, 9.4567),
      entry("Harker", "Lee & Kim", 1, 9.9),
      entry("Strake Jesuit", "AB", 2, 9.123),
      entry("", "Nobody", 4, 1),
    ])
    expect(teams).toEqual({ "harker-lee-kim": [9.9, 1], "strake-jesuit-ab": [9.12, 2] })
    expect(eloTeamKey({ school: "Harker", name: "Lee & Kim" })).toBe("harker-lee-kim")
  })

  it("gives each asked-for team its saved months, oldest first, and leaves out teams with none", () => {
    const history = eloHistoryFor(
      [
        { month: "2026-10", teams: { a: [9, 4] } },
        { month: "2026-11", teams: { a: [9.5, 2], b: [8, 10] } },
      ],
      ["a", "c"],
    )
    expect(history).toEqual({
      a: [
        { month: "2026-10", rating: 9, rank: 4 },
        { month: "2026-11", rating: 9.5, rank: 2 },
      ],
    })
  })

  it("knows the datasets it snapshots", () => {
    expect(isEloHistoryDataset("hspf")).toBe(true)
    expect(isEloHistoryDataset("npdl")).toBe(false)
  })
})

describe("EloSparkline", () => {
  it("renders nothing without saved months", () => {
    expect(renderToStaticMarkup(createElement(EloSparkline, { points: undefined }))).toBe("")
    expect(renderToStaticMarkup(createElement(EloSparkline, { points: [] }))).toBe("")
  })

  it("draws a rising line in green with a summary label", () => {
    const points = [
      { month: "2026-10", rating: 9, rank: 4 },
      { month: "2026-11", rating: 9.5, rank: 2 },
    ]
    const html = renderToStaticMarkup(createElement(EloSparkline, { points }))
    expect(html).toContain("<path")
    expect(html).toContain("text-emerald-600")
    expect(eloSparklineLabel(points)).toBe("Rating 9.0 (#4) in Oct 2026 to 9.5 (#2) in Nov 2026, +0.5 over 2 months")
  })

  it("shows a single saved month as a dot", () => {
    const html = renderToStaticMarkup(createElement(EloSparkline, { points: [{ month: "2026-11", rating: 9, rank: 4 }] }))
    expect(html).toContain("<circle")
    expect(html).not.toContain("<path")
  })
})
