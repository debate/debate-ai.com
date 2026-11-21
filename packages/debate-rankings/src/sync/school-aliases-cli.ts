/**
 * Regenerates `src/schools/school-alias-data.ts` from every college table in
 * the repo. Run from packages/debate-rankings: `bun src/sync/school-aliases-cli.ts`.
 * `collegeNameSources` is shared with the test that checks the file is current.
 */
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { parseCollegeHistory } from "../college-history"
import { parseCsv } from "../parse"
import { rawSchoolHandle } from "../leaderboard/profile/rankingProfileHelpers"
import { buildCollegeAliases, renderCollegeAliasData, type SchoolNameSource } from "../schools/school-aliases"
import { CEDA_CHAMPIONS } from "./ceda-champions"
import { SHIRLEY_RESULTS } from "./shirley-results"

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "../..")

/** Every college name in the repo's tables: current rankings first (they win). */
export function collegeNameSources(root = PACKAGE_ROOT): SchoolNameSource[] {
  const sources: SchoolNameSource[] = []
  const [header, ...rows] = parseCsv(readFileSync(path.join(root, "../debate-rankings-sync-data/output/cpd_full_rankings.csv"), "utf8"))
  const schoolColumn = header.indexOf("School")
  for (const row of rows) sources.push({ name: row[schoolColumn], current: true })
  for (const list of parseCollegeHistory(readFileSync(path.join(root, "src/history/cpd-debatedata.csv"), "utf8")).values()) {
    for (const entry of list) sources.push({ name: entry.school })
  }
  const ndt = JSON.parse(readFileSync(path.join(root, "data/ndt-school-history.json"), "utf8")) as { school: string }[]
  for (const school of ndt) sources.push({ name: school.school })
  for (const champion of CEDA_CHAMPIONS) sources.push({ name: champion.school })
  for (const result of SHIRLEY_RESULTS) sources.push({ name: result.school })
  return sources
}

/** The generated file's text. */
export function collegeAliasDataSource(root = PACKAGE_ROOT): string {
  return renderCollegeAliasData(buildCollegeAliases(collegeNameSources(root), rawSchoolHandle))
}

if (import.meta.main) {
  const out = path.join(PACKAGE_ROOT, "src/schools/school-alias-data.ts")
  writeFileSync(out, collegeAliasDataSource())
  console.log(`wrote ${out}`)
}
