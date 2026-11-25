/**
 * @fileoverview The national championship results a high school's program
 * strength scores: the Tournament of Champions plus the NDCA, the Cal
 * Invitational (UC Berkeley) and the Glenbrooks, in Policy, Lincoln-Douglas
 * and Public Forum. Each school's TOC record ({@link tocRecordsBySchool})
 * gains its NDCA, Cal and Glenbrooks finishes, so everything that scores
 * program strength from TOC records (school pages' season chart, the
 * all-time and decade ranks, the Elite 8 charts) counts all four alike.
 *
 * Results are filed by season, named by the year it ends in, like the TOC
 * (held in April): the NDCA (spring) and the Cal (February) keep their year,
 * and a November Glenbrooks belongs to the next year's season. An NDCA, Cal or
 * Glenbrooks finalist scores as a TOC runner-up; finishes below the
 * semifinals and speaker places past first score nothing, as at the TOC. The
 * Barkley Forum isn't counted here.
 * @module sync/hs-program-records
 */

import { CAL_RESULTS, type CalResult } from "./berkeley-champions"
import { GLENBROOKS_RESULTS, type GlenbrooksResult } from "./glenbrooks-champions"
import { NDCA_HISTORY, ndcaEvent, type NdcaResult } from "./ndca-champions"
import {
  matchTocSchool,
  TOC_HISTORY,
  tocRecordsBySchool,
  tocSchoolKey,
  tocSchoolMatcher,
  tocSchoolState,
  type TocPlace,
  type TocResult,
  type TocSchoolRecord,
} from "./toc-champions"

/** The championships program strength counts. */
export type HsProgramTournament = "TOC" | "NDCA" | "Cal" | "Glenbrooks"

/** One scored result, in the TOC's shape, tagged with its tournament. `year` is the season's ending year. */
export type HsProgramResult = TocResult & { tournament: HsProgramTournament }

/** A school's TOC record with its other national results added. */
export interface HsProgramRecord extends TocSchoolRecord {
  results: HsProgramResult[]
}

const DEBATE_EVENTS = new Set(["Policy", "Lincoln-Douglas", "Public Forum"])

/** A place in the TOC's terms, or `null` for one program strength doesn't score. */
function tocPlace(place: string): TocPlace | null {
  if (place === "Finalist" || place === "Runner-up") return "Runner-up"
  if (place === "Champion" || place === "Co-champion" || place === "Semifinalist" || place === "Top speaker") return place
  return null
}

/** NDCA, Cal and Glenbrooks results as scored rows, with the school as the source spells it. */
export function otherNationalsResults(
  ndca: readonly NdcaResult[] = NDCA_HISTORY,
  cal: readonly CalResult[] = CAL_RESULTS,
  glenbrooks: readonly GlenbrooksResult[] = GLENBROOKS_RESULTS,
): HsProgramResult[] {
  const rows: HsProgramResult[] = []
  const push = (tournament: HsProgramTournament, year: number, event: string, place: string, school: string, competitors: string) => {
    const mapped = tocPlace(place)
    if (!mapped || !DEBATE_EVENTS.has(event)) return
    rows.push({ tournament, year, event: event as TocResult["event"], place: mapped, school, competitors })
  }
  for (const r of ndca) push("NDCA", r.year, ndcaEvent(r), r.place, r.school, r.competitors)
  for (const r of cal) push("Cal", r.year, r.event, r.place, r.school, r.competitors)
  // Held in November: the next year's season.
  for (const r of glenbrooks) push("Glenbrooks", r.year + 1, r.event, r.place, r.school, r.competitors)
  return rows
}

function record(school: string, results: HsProgramResult[], base?: TocSchoolRecord): HsProgramRecord {
  const sorted = [...results].sort((a, b) => a.year - b.year)
  return base
    ? { ...base, results: sorted }
    : {
        school,
        results: sorted,
        titles: 0,
        runnerUps: 0,
        semifinalists: 0,
        topSpeakers: 0,
        events: [],
      }
}

/**
 * Every school's program-strength record: each TOC record (its counts stay
 * TOC-only) with its NDCA, Cal and Glenbrooks results added, plus a record for
 * each school with national results but no TOC finish. A row whose school
 * shares a TOC school's name but can't be told apart from it (no state tag
 * among same-named schools) is left out rather than credited to one of them.
 */
export function hsProgramRecords(
  toc: readonly TocResult[] = TOC_HISTORY,
  others: readonly HsProgramResult[] = otherNationalsResults(),
): HsProgramRecord[] {
  const tocRecords = tocRecordsBySchool([...toc])
  const match = tocSchoolMatcher(tocRecords)
  const tocKeys = new Set(tocRecords.map((r) => tocSchoolKey(r.school)))
  const added = new Map<TocSchoolRecord, HsProgramResult[]>()
  // Schools with no TOC record, by key and state tag.
  const others_ = new Map<string, { school: string; results: HsProgramResult[] }>()
  for (const row of others) {
    const found = match(row.school)
    if (found) {
      const list = added.get(found) ?? []
      list.push(row)
      added.set(found, list)
      continue
    }
    const key = tocSchoolKey(row.school)
    if (!key || tocKeys.has(key)) continue
    const groupKey = `${key}|${tocSchoolState(row.school) ?? ""}`
    const group = others_.get(groupKey) ?? { school: row.school, results: [] }
    group.results.push(row)
    others_.set(groupKey, group)
  }
  // A state-less group is the same school as a same-named group with a state tag.
  for (const [groupKey, group] of others_) {
    if (!groupKey.endsWith("|")) continue
    const tagged = [...others_].filter(([k]) => k !== groupKey && k.startsWith(groupKey))
    if (tagged.length === 1) {
      tagged[0][1].results.push(...group.results)
      others_.delete(groupKey)
    }
  }
  return [
    ...tocRecords.map((base) =>
      record(base.school, [...base.results.map((r) => ({ ...r, tournament: "TOC" as const })), ...(added.get(base) ?? [])], base),
    ),
    ...[...others_.values()].map((group) => record(group.school, group.results)),
  ]
}

let cached: HsProgramRecord[] | null = null

/** {@link hsProgramRecords} over the bundled histories, built once. */
export function bundledHsProgramRecords(): HsProgramRecord[] {
  cached ??= hsProgramRecords()
  return cached
}

/** A high school's program-strength record by {@link matchTocSchool}'s rules, or `null`. */
export function findHsProgramRecord(school: string, records: readonly HsProgramRecord[] = bundledHsProgramRecords()): HsProgramRecord | null {
  return matchTocSchool(school, records)
}
