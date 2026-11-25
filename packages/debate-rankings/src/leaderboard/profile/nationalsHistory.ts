/**
 * @fileoverview Pure helpers behind a high school's national finishes: the
 * Tournament of Champions, NDCA, Barkley Forum, Cal Invitational and
 * Glenbrooks rows for one school, in one newest-first list
 * ({@link schoolNationals}), and the finishes of one team among them
 * ({@link findNationalsTeamFinishes}), which lets a team named only in those
 * records still have a team page.
 * @module leaderboard/profile/nationalsHistory
 */

import { findNdcaSchoolRecord, ndcaEvent, ndcaPlaceLabel, type NdcaSchoolRecord } from "../../sync/ndca-champions"
import { findTocSchoolRecord, type TocSchoolRecord } from "../../sync/toc-champions"
import { findBarkleySchoolResults } from "../../sync/barkley-champions"
import { findCalSchoolResults } from "../../sync/berkeley-champions"
import { findGlenbrooksSchoolResults } from "../../sync/glenbrooks-champions"
import { pastHighSchoolTeamHandle } from "./pastHighSchoolTeam"
import { profileSlug } from "./rankingProfileHelpers"

export type NationalsTournament = "TOC" | "NDCA" | "Barkley" | "Cal" | "Glenbrooks"

/** One listed finish, from any of the tournaments. */
export interface NationalsRow {
  tournament: NationalsTournament
  year: number
  event: string
  place: string
  label: string
  competitors: string
  formerName?: string
  /** The source doesn't settle the result (Glenbrooks rows marked probable). */
  probable?: boolean
}

/** Best finish first within a year. */
const PLACE_ORDER = [
  "Champion",
  "Co-champion",
  "Runner-up",
  "Finalist",
  "Top speaker",
  "Semifinalist",
  "Quarterfinalist",
  "Octafinalist",
  "Double-octafinalist",
]

const placeRank = (place: string) => {
  const i = PLACE_ORDER.indexOf(place)
  return i === -1 ? PLACE_ORDER.length : i
}

export const NATIONALS_TOURNAMENT_ORDER: NationalsTournament[] = ["TOC", "NDCA", "Barkley", "Cal", "Glenbrooks"]

/** Everything the nationals records hold for one school. */
export interface SchoolNationals {
  toc: TocSchoolRecord | null
  ndca: NdcaSchoolRecord | null
  barkley: ReturnType<typeof findBarkleySchoolResults>
  cal: ReturnType<typeof findCalSchoolResults>
  glenbrooks: ReturnType<typeof findGlenbrooksSchoolResults>
  /** Every finish but speaker places below first, newest year first. */
  rows: NationalsRow[]
}

/**
 * A school's TOC, NDCA, Barkley, Cal and Glenbrooks records and their finishes
 * as one list: newest year first, then by tournament, then best place first.
 *
 * @param school - School name as the rankings or a school page spell it.
 */
export function schoolNationals(school: string): SchoolNationals {
  const toc = findTocSchoolRecord(school)
  const ndca = findNdcaSchoolRecord(school)
  const barkley = findBarkleySchoolResults(school)
  const cal = findCalSchoolResults(school)
  const glenbrooks = findGlenbrooksSchoolResults(school)
  const rows: NationalsRow[] = []
  for (const r of toc?.results ?? []) {
    if (r.place === "Speaker") continue
    rows.push({
      tournament: "TOC",
      year: r.year,
      event: r.event,
      place: r.place,
      label: r.place,
      competitors: r.competitors,
      formerName: r.formerName,
    })
  }
  for (const r of ndca?.results ?? []) {
    if (r.place === "Speaker") continue
    rows.push({
      tournament: "NDCA",
      year: r.year,
      event: ndcaEvent(r),
      place: r.place,
      label: ndcaPlaceLabel(r),
      competitors: r.competitors,
    })
  }
  for (const [tournament, list] of [
    ["Barkley", barkley],
    ["Cal", cal],
  ] as const) {
    for (const r of list) {
      rows.push({ tournament, year: r.year, event: r.event, place: r.place, label: r.place, competitors: r.competitors })
    }
  }
  for (const r of glenbrooks) {
    rows.push({
      tournament: "Glenbrooks",
      year: r.year,
      event: r.event,
      place: r.place,
      label: r.place,
      competitors: r.competitors,
      probable: r.probable,
    })
  }
  rows.sort(
    (a, b) =>
      b.year - a.year ||
      NATIONALS_TOURNAMENT_ORDER.indexOf(a.tournament) - NATIONALS_TOURNAMENT_ORDER.indexOf(b.tournament) ||
      placeRank(a.place) - placeRank(b.place),
  )
  return { toc, ndca, barkley, cal, glenbrooks, rows }
}

/**
 * The finishes of the team an `@handle` names among one school's nationals
 * rows: those whose debaters' last names, after the school key, spell the
 * handle (`pastHighSchoolTeamHandle`). Empty when none do.
 *
 * @param school - School name as the rankings spell it.
 * @param schoolKey - `schoolSeasonKey` of `school`.
 * @param slug - The `@handle`, without its `@`.
 */
export function findNationalsTeamFinishes(school: string, schoolKey: string, slug: string): NationalsRow[] {
  let decoded = slug ?? ""
  try {
    decoded = decodeURIComponent(decoded)
  } catch {
    // A malformed escape is used as-is.
  }
  const target = profileSlug(decoded)
  return schoolNationals(school).rows.filter(
    (row) => row.competitors.trim() !== "" && pastHighSchoolTeamHandle(schoolKey, row.competitors) === target,
  )
}
