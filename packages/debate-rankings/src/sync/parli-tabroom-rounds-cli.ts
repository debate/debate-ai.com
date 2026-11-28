/**
 * @fileoverview CLI: refresh the bundled parli round snapshot,
 * `data/npdl-tabroom-rounds.json`, from the NPDL's Tabroom circuit.
 *
 *   bun run sync-parli-rounds
 *   bun run sync-parli-rounds -- --tourn 41226 --tourn 38795
 *
 * Reads public pairing pages only unless `TABROOM_API_KEY` is set, in which
 * case each round's ballots are read too and every round gets a winner and
 * ballot count (see `parli-tabroom-rounds.ts`). The calendar shows the
 * circuit's current season; other seasons already in the file are kept. A
 * sync that finds no pairings at all keeps the old file.
 * @module sync/parli-tabroom-rounds-cli
 */

import { readFileSync, writeFileSync } from "node:fs"
import { parseArgs } from "node:util"
import { fetchParliRoundsSeason, type ParliRoundsSeason } from "./parli-tabroom-rounds"
import { getTabroomCookie } from "./sync-rankings-ndca"

const { values } = parseArgs({
  options: {
    tourn: { type: "string", multiple: true },
    delay: { type: "string", default: "400" },
  },
})

const output = new URL("../../data/npdl-tabroom-rounds.json", import.meta.url)
let snapshot: Record<string, ParliRoundsSeason> = {}
try {
  snapshot = JSON.parse(readFileSync(output, "utf8"))
} catch {
  // first run
}

const cookie = getTabroomCookie()
console.log(cookie ? "TABROOM_API_KEY set: reading ballots too" : "no TABROOM_API_KEY: public pairings only (no round winners)")
const season = await fetchParliRoundsSeason({
  cookie: cookie || undefined,
  delayMs: Number(values.delay),
  only: values.tourn,
  log: (line) => console.log(line),
})

const pairings = season.tournaments.reduce(
  (n, t) => n + t.events.reduce((m, e) => m + e.rounds.reduce((k, r) => k + r.pairings.length, 0), 0),
  0,
)
if (pairings === 0) {
  console.error("no pairings found; keeping the existing file")
  process.exit(1)
}
snapshot[season.season] = season
const ordered = Object.fromEntries(Object.entries(snapshot).sort(([a], [b]) => b.localeCompare(a)))
writeFileSync(output, `${JSON.stringify(ordered)}\n`)
console.log(`Wrote ${season.season}: ${season.tournaments.length} tournaments, ${pairings} pairings to ${output.pathname}`)
