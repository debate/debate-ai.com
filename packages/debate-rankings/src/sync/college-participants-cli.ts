/**
 * @fileoverview CLI: `bun run sync-college-participants` looks every high
 * school Greatest of All Time debater up in College Debate Results and writes
 * the college debaters whose name matches to
 * `data/college-results-participants.json` (see `sync/college-participants`).
 * Rerun it after the high school results change.
 * @module sync/college-participants-cli
 */

import { writeFileSync } from "node:fs"
import { buildHsAllTimeTeams, sameHsDebater } from "../leaderboard/profile/hsAllTimeTeams"
import { collegeResultsFetcher, fetchCollegeParticipants } from "./college-participants"

// buildHsAllTimeTeams asks the college lookup for every spelling of every debater.
const asked = new Set<string>()
buildHsAllTimeTeams({
  college: (name) => {
    asked.add(name)
    return null
  },
})
const names = [...asked]

const { participants, listed, candidates } = await fetchCollegeParticipants(collegeResultsFetcher(), (full) =>
  names.some((name) => sameHsDebater(name, full)),
)

const output = new URL("../../data/college-results-participants.json", import.meta.url)
writeFileSync(output, `[\n${participants.map((p) => JSON.stringify(p)).join(",\n")}\n]\n`)
console.log(
  `${names.length} high school names; ${listed} college debaters listed, ${candidates} name matches, ` +
    `${participants.length} written to ${output.pathname}`,
)
