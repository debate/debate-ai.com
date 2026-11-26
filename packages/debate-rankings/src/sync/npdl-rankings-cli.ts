/**
 * @fileoverview CLI: refresh the bundled NPDL parliamentary rankings snapshot,
 * `data/npdl-rankings.json`, from parliamentarydebate.org.
 *
 *   bun run sync-npdl -- --season 2024-25
 *   bun run sync-npdl -- --all-seasons
 *
 * Seasons already in the file and not re-scraped are kept. A season that fails
 * keeps its old copy. Sanity check: 2024-25 gives 877 team rows and 25 school
 * rows; far fewer means a truncated page, not a good scrape.
 * @module sync/npdl-rankings-cli
 */

import { readFileSync, writeFileSync } from "node:fs"
import { parseArgs } from "node:util"
import { fetchNpdlSeason, NPDL_SEASONS, type NpdlSeasonRankings } from "./sync-npdl-rankings"

const { values } = parseArgs({
  options: {
    season: { type: "string", multiple: true },
    "all-seasons": { type: "boolean", default: false },
    sleep: { type: "string", default: "1500" },
  },
})

const seasons = values["all-seasons"] ? NPDL_SEASONS : (values.season ?? [])
const unknown = seasons.filter((s) => !NPDL_SEASONS.includes(s))
if (seasons.length === 0 || unknown.length > 0) {
  if (unknown.length) console.error(`unknown season(s): ${unknown.join(", ")}`)
  console.error(`usage: bun run sync-npdl -- --season <${NPDL_SEASONS.join("|")}> | --all-seasons`)
  process.exit(1)
}

const output = new URL("../../data/npdl-rankings.json", import.meta.url)
let snapshot: Record<string, NpdlSeasonRankings> = {}
try {
  snapshot = JSON.parse(readFileSync(output, "utf8"))
} catch {
  // first run
}

let failures = 0
for (const [i, season] of seasons.entries()) {
  if (i > 0) await new Promise((r) => setTimeout(r, Number(values.sleep)))
  console.log(`[${season}]`)
  try {
    const result = await fetchNpdlSeason(season, { log: (line) => console.log(line) })
    snapshot[season] = result
    console.log(`  ${result.teams.length} teams, ${result.schools.length} schools`)
  } catch (err) {
    failures++
    console.error(`  ! ${(err as Error).message}`)
  }
}

const ordered = Object.fromEntries(
  NPDL_SEASONS.filter((s) => snapshot[s]).map((s) => [s, snapshot[s]]),
)
writeFileSync(output, `${JSON.stringify(ordered)}\n`)
console.log(`Wrote ${Object.keys(ordered).length} season(s) to ${output.pathname}`)
if (failures) process.exit(1)
