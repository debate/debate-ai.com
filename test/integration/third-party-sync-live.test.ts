import { describe, expect, it } from "vitest"

import { scrapeAll as scrapeDebateland } from "../../lib/sync-debate-rankings/sync-rankings-debateland"
import { scrapeAll as scrapeDebateDrills } from "../../lib/sync-debate-rankings/sync-rankings-debatedrills"
import { scrapeToc } from "../../lib/sync-debate-rankings/sync-rankings-tocbidlist"
import { getTournamentNames } from "../../lib/sync-debate-rankings/sync-tournaments"

const runLive = process.env.SYNC_LIVE === "1" || process.env.RUN_SYNC_INTEGRATION === "1"
const integrationDescribe = runLive ? describe : describe.skip

integrationDescribe("live third-party sync endpoints", () => {
  const currentYear = new Date().getFullYear().toString()

  it("fetches DebateDrills rankings CSVs and parses entries", async () => {
    const entries = await scrapeDebateDrills(currentYear)
    console.log("DebateDrills entries sample", entries.slice(0, 3))
    expect(entries.length).toBeGreaterThan(0)
  })

  it("scrapes Debateland leaderboard JSON", async () => {
    const entries = await scrapeDebateland(currentYear)
    console.log("Debateland leaderboard count", entries.length)
    expect(entries.length).toBeGreaterThan(0)
  })

  it("retrieves TOC bid list JSON", async () => {
    const rows = await scrapeToc("PF")
    console.log("TOC PF rows", rows.length, rows.slice(0, 2))
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBeGreaterThan(0)
  })

  it("queries Tabroom tournament names", async () => {
    const names = await getTournamentNames()
    console.log("Tabroom tournaments", names.slice(0, 5))
    expect(names.length).toBeGreaterThan(0)
  })
})
