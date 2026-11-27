/**
 * @fileoverview The greatest high school teams of all time in Policy,
 * Lincoln-Douglas and Public Forum, the high school counterpart of the
 * college "Greatest of All Time" list, scored with that list's weights so
 * high school finishes and college careers are balanced. A team scores its
 * national championship finishes at the high school championships, weighted
 * alike at the college list's high school points ({@link HS_ALL_TIME_POINTS},
 * a TOC title is 10 to an NDT title's 30) times {@link HS_ALL_TIME_MULTIPLIER}
 * and the era multiplier (before 2000, 0.6): every
 * Tournament of Champions result on record (1972 on), every NDCA championship
 * result (2006 on) and the Barkley Forum's Silver Key champions and top
 * speakers (2018, 2021 on), and the Cal Invitational at UC Berkeley's LD and
 * PF finals and top speakers (2017–2019, 2022, 2024), and the Glenbrooks'
 * Policy, LD and PF finals, named semifinalists and top speakers (1980 on).
 * On top of that, each debater who went on to debate in college adds a share
 * ({@link HS_ALL_TIME_COLLEGE_SHARE}) of their own all-seasons NDT points,
 * high school credit left out so it isn't counted twice, plus one college
 * point just for participating ({@link HS_ALL_TIME_PARTICIPATION_POINTS}):
 * a debater with an NDT record, or one College Debate Results lists
 * (`sync/college-participants`) under a matching name who first debated after
 * their last high school nationals, counts once, at the same share, with or
 * without NDT points.
 *
 * A "team" is a pair in Policy and Public Forum and one debater in
 * Lincoln-Douglas, at one school, across every year it debated. Sources
 * spell the same debater differently ("Sanjena Anshu Sathian" at the TOC,
 * "Anshu Sathian" at the NDCA; "Desphande"/"Deshpande"; "Rishee"/"Rishi"), so
 * a debater matches on surname plus given names where one spelling's are a
 * subset of the other's ({@link sameHsDebater}), after {@link NDCA_NAME_ALIASES};
 * partner order does not matter. Schools match on {@link tocSchoolKey}. A
 * top speaker award goes to the pair that speaker debated in that year at
 * that school (the LD debater themself); a Policy or PF speaker whose pair
 * has no recorded finish that year isn't credited, since the partner is
 * unknown. When one debater appears on more than two partnerships, only the
 * top two by score stay as rows; later partnerships' finishes and points are
 * folded into those two with a footnote (e.g. “2005 Glenbrooks Champion —
 * with Josh McLaurin”). Rows the source names only by surname or team code
 * (`partialNames`) can't be told apart from other teams, so they don't count
 * here (they still show on the school's nationals list).
 * @module leaderboard/profile/hsAllTimeTeams
 */

import type { CollegeParticipant } from "../../sync/college-participants"
import { BARKLEY_RESULTS, type BarkleyResult } from "../../sync/barkley-champions"
import { CAL_RESULTS, type CalResult } from "../../sync/berkeley-champions"
import { GLENBROOKS_RESULTS, type GlenbrooksResult } from "../../sync/glenbrooks-champions"
import { NDCA_HISTORY, NDCA_NAME_ALIASES, ndcaEvent, type NdcaResult } from "../../sync/ndca-champions"
import {
  HS_NDCA_FINISH_POINTS,
  HS_TOC_POINTS,
  ndtEraMultiplier,
  type NdtAllSeasonsTable,
} from "./ndtAllSeasons"
import { profileSlug } from "./rankingProfileHelpers"
import { matchTocSchool, TOC_HISTORY, tocSchoolKey, type TocResult } from "../../sync/toc-champions"

/** The three high school debate events with an all-time list, in page order. */
export type HsAllTimeEvent = "Policy" | "Lincoln-Douglas" | "Public Forum"

export const HS_ALL_TIME_EVENTS: readonly HsAllTimeEvent[] = ["Policy", "Lincoln-Douglas", "Public Forum"]

/** The national championships a team's finishes come from. */
export type HsAllTimeTournament = "TOC" | "NDCA" | "Barkley" | "Cal" | "Glenbrooks"

/**
 * What each debater's college NDT points are multiplied by when added to their
 * high school team. Well under full value, so strong high school careers are
 * not buried under a single large college score.
 */
export const HS_ALL_TIME_COLLEGE_SHARE = 0.35

/**
 * College points a debater gets just for debating in college, in the same
 * unit as NDT points (so it counts at {@link HS_ALL_TIME_COLLEGE_SHARE}), added
 * once on top of any NDT points.
 */
export const HS_ALL_TIME_PARTICIPATION_POINTS = 1

/**
 * How many years after a high school debater's last nationals the first
 * college season in College Debate Results may end and still be them, so a
 * same-named debater from another generation isn't credited.
 */
export const HS_COLLEGE_MAX_GAP_YEARS = 3

/**
 * The longest a college record may run (first season to last, in years) and
 * still be a student's: a record spanning decades is a coach or judge who
 * shares the name.
 */
export const HS_COLLEGE_MAX_CAREER_YEARS = 6

/**
 * Base points per national finish, TOC, NDCA, Barkley Forum, Cal and Glenbrooks alike: the
 * college all-seasons list's high school points ({@link HS_TOC_POINTS},
 * {@link HS_NDCA_FINISH_POINTS}), before {@link HS_ALL_TIME_MULTIPLIER} and
 * the era multiplier.
 */
export const HS_ALL_TIME_POINTS: Record<string, number> = {
  Champion: HS_TOC_POINTS.Champion,
  "Co-champion": HS_TOC_POINTS["Co-champion"],
  "Runner-up": HS_TOC_POINTS["Runner-up"],
  Finalist: HS_NDCA_FINISH_POINTS.Finalist,
  Semifinalist: HS_NDCA_FINISH_POINTS.Semifinalist,
  Quarterfinalist: HS_NDCA_FINISH_POINTS.Quarterfinalist,
  Octafinalist: HS_NDCA_FINISH_POINTS.Octafinalist,
  "Double-octafinalist": HS_NDCA_FINISH_POINTS["Double-octafinalist"],
  "Top speaker": HS_TOC_POINTS["Top speaker"],
}

/**
 * What a high school finish's base points are multiplied by. Above the college
 * list's 0.5× highSchool share, so national championship careers weigh more
 * against college padding.
 */
export const HS_ALL_TIME_MULTIPLIER = 1.5

/** How many partnerships one debater may keep as separate rows; further ones fold into these. */
export const HS_ALL_TIME_MAX_PARTNERSHIPS = 2

/** A finish's points: base × {@link HS_ALL_TIME_MULTIPLIER} × the era multiplier. */
export function hsAllTimeFinishPoints(place: string, year: number): number {
  return round2((HS_ALL_TIME_POINTS[place] ?? 0) * HS_ALL_TIME_MULTIPLIER * ndtEraMultiplier(year))
}

/** One finish that scored toward a team. */
export interface HsAllTimeFinish {
  tournament: HsAllTimeTournament
  year: number
  place: string
  points: number
}

/** One debater's college record, as it adds to their high school team. */
export interface HsAllTimeCollege {
  /** The debater as the high school source spells them. */
  debater: string
  /** Their NDT school, e.g. `"Northwestern University (IL)"`. */
  school: string
  /** Their own all-seasons NDT points, high school credit left out; 0 for a debater only College Debate Results lists. */
  collegePoints: number
  /** The participation point ({@link HS_ALL_TIME_PARTICIPATION_POINTS}); every listed college debater has it. */
  participationPoints: number
  /** Where the participation comes from: an NDT record, or College Debate Results alone. */
  participation: "ndt" | "results"
  /** What it adds to the team: ({@link collegePoints} + {@link participationPoints}) times {@link HS_ALL_TIME_COLLEGE_SHARE}. */
  credit: number
}

/** A debater's college NDT points by name, or `null` for one who didn't debate at the NDT. */
export type HsCollegeLookup = (debater: string) => { school: string; points: number } | null

/** The years a high school team debated, to tell its debaters from same-named college debaters. */
export interface HsDebaterYears {
  firstYear: number
  lastYear: number
}

/** The college debater College Debate Results lists under a high school debater's name, or `null`. */
export type HsParticipationLookup = (debater: string, years: HsDebaterYears) => CollegeParticipant | null

/** One team in an event's all-time list. */
export interface HsAllTimeTeam {
  /** 1-based; equal totals share a rank. */
  rank: number
  event: HsAllTimeEvent
  /** The school as the source names it, without a state tag. */
  school: string
  /** {@link tocSchoolKey} of the school, for matching a school page. */
  schoolKey: string
  /** The school as the source names it, state tag kept, for {@link matchTocSchool}. */
  sourceSchool: string
  /** The debaters' full names, e.g. `"Tanner Lewis & Clyde Shepherd"`. */
  debaters: string
  /** Last names, e.g. `"Lewis & Shepherd"`. */
  lastNames: string
  firstYear: number
  lastYear: number
  total: number
  /** Points from national finishes alone. */
  nationals: number
  /** Points added from the debaters' college records. */
  collegeCredit: number
  titles: number
  finishes: HsAllTimeFinish[]
  /** Debaters with a college record, best first. */
  college: HsAllTimeCollege[]
  /**
   * Finishes folded in from a later partnership of a shared debater, e.g.
   * `"2005 Glenbrooks Champion — with Josh McLaurin"`.
   */
  notes: string[]
}

type Source = { tournament: HsAllTimeTournament; event: string; year: number; place: string; school: string; competitors: string; partialNames?: boolean }

/** Canonical spelling for a high school name (Desphande → Deshpande, Rishee → Rishi). */
export function canonicalHsDebater(name: string): string {
  const trimmed = name.trim()
  return NDCA_NAME_ALIASES[trimmed] ?? trimmed
}

/** The debaters a source's competitors string names, spellings canonicalized. */
export const splitNames = (competitors: string) =>
  competitors
    .split(/\s*(?:&|\/|,| and )\s*/i)
    .map((name) => canonicalHsDebater(name.trim()))
    .filter(Boolean)

const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z]/g, "")
const lastWord = (name: string) => name.trim().split(/\s+/).at(-1) ?? ""

/** A name's given-name words (every word but the surname), normalized: `"Sanjena Anshu Sathian"` → `["sanjena", "anshu"]`. */
const givenNames = (name: string) => name.trim().split(/\s+/).slice(0, -1).map(nameKey).filter(Boolean)

/**
 * Whether two spellings name the same debater: the same surname, and one
 * spelling's given names all appear in the other's, so a source that drops
 * a first or middle name still matches (`"Anshu Sathian"` and
 * `"Sanjena Anshu Sathian"`). Names go through {@link canonicalHsDebater}
 * first. Both need a given name, so a bare surname never matches, and
 * different first names (siblings at one school) stay apart. Callers only
 * compare debaters at the same school in the same event.
 */
export function sameHsDebater(a: string, b: string): boolean {
  const left = canonicalHsDebater(a)
  const right = canonicalHsDebater(b)
  if (nameKey(lastWord(left)) !== nameKey(lastWord(right))) return false
  if (nameKey(left) === nameKey(right)) return true
  const [x, y] = [givenNames(left), givenNames(right)]
  if (!x.length || !y.length) return false
  const [short, long] = x.length <= y.length ? [x, y] : [y, x]
  return short.every((word) => long.includes(word))
}
const withoutState = (school: string) => school.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim()

function sources(
  toc: readonly TocResult[],
  ndca: readonly NdcaResult[],
  barkley: readonly BarkleyResult[],
  cal: readonly CalResult[],
  glenbrooks: readonly GlenbrooksResult[],
): Source[] {
  return [
    ...toc.map((r) => ({ tournament: "TOC" as const, ...r })),
    ...ndca.map((r) => ({ tournament: "NDCA" as const, ...r, event: ndcaEvent(r) })),
    ...barkley.map((r) => ({ tournament: "Barkley" as const, ...r })),
    ...cal.map((r) => ({ tournament: "Cal" as const, ...r })),
    ...glenbrooks.map((r) => ({ tournament: "Glenbrooks" as const, ...r })),
  ]
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * A lookup of each debater's own college points from the all-seasons NDT
 * table's `debaters` rows (total minus the high school part), by name slug;
 * high school spellings go through `NDCA_NAME_ALIASES`. A name two colleges
 * share keeps the better record.
 */
export function collegeLookupFromNdt(table: Pick<NdtAllSeasonsTable, "debaters">): HsCollegeLookup {
  const bySlug = new Map<string, { school: string; points: number }>()
  for (const row of table.debaters) {
    const points = round2(row.total - (row.parts.highSchool ?? 0))
    if (points <= 0) continue
    const slug = profileSlug(row.team)
    const seen = bySlug.get(slug)
    if (!seen || seen.points < points) bySlug.set(slug, { school: row.school, points })
  }
  return (debater) => bySlug.get(profileSlug(NDCA_NAME_ALIASES[debater] ?? debater)) ?? null
}

/**
 * A lookup of the college debaters College Debate Results lists, by name. A
 * name matches on {@link sameHsDebater} (same surname, given names that
 * agree) and counts only when the college debater's first season ended after
 * the high school debater's last nationals and within
 * {@link HS_COLLEGE_MAX_GAP_YEARS} of it, their record spans at most
 * {@link HS_COLLEGE_MAX_CAREER_YEARS} years, and exactly one such college debater
 * has the name; two same-named candidates are left uncredited, since they
 * can't be told apart.
 */
export function participationLookupFromResults(participants: readonly CollegeParticipant[]): HsParticipationLookup {
  const bySurname = new Map<string, CollegeParticipant[]>()
  for (const participant of participants) {
    const key = nameKey(lastWord(canonicalHsDebater(participant.name)))
    bySurname.set(key, [...(bySurname.get(key) ?? []), participant])
  }
  return (debater, { lastYear }) => {
    const name = canonicalHsDebater(debater)
    const matches = (bySurname.get(nameKey(lastWord(name))) ?? []).filter(
      (p) =>
        sameHsDebater(name, p.name) &&
        p.firstYear > lastYear &&
        p.firstYear <= lastYear + HS_COLLEGE_MAX_GAP_YEARS &&
        p.lastYear - p.firstYear <= HS_COLLEGE_MAX_CAREER_YEARS,
    )
    return matches.length === 1 ? matches[0] : null
  }
}

/** Inputs to {@link buildHsAllTimeTeams}; each defaults to the bundled history, college to none. */
export interface HsAllTimeSources {
  toc?: readonly TocResult[]
  ndca?: readonly NdcaResult[]
  barkley?: readonly BarkleyResult[]
  cal?: readonly CalResult[]
  glenbrooks?: readonly GlenbrooksResult[]
  college?: HsCollegeLookup | null
  /** The college debaters College Debate Results lists; each gets {@link HS_ALL_TIME_PARTICIPATION_POINTS}. */
  participation?: HsParticipationLookup | null
}

interface Building {
  event: HsAllTimeEvent
  school: string
  sourceSchool: string
  schoolKey: string
  names: string[]
  /** Every spelling seen for each of {@link names}, for the college lookup. */
  spellings: string[][]
  finishes: HsAllTimeFinish[]
}

/**
 * Every scoring team per event, best first. Teams tie on total; ties list
 * the more titles first, then the more recent team.
 *
 * @param input - The results to score and the college lookup ({@link HsAllTimeSources}).
 */
export function buildHsAllTimeTeams(input: HsAllTimeSources = {}): Record<HsAllTimeEvent, HsAllTimeTeam[]> {
  const { toc = TOC_HISTORY, ndca = NDCA_HISTORY, barkley = BARKLEY_RESULTS, cal = CAL_RESULTS, glenbrooks = GLENBROOKS_RESULTS, college = null, participation = null } = input
  const events = new Set<string>(HS_ALL_TIME_EVENTS)
  const rows = sources(toc, ndca, barkley, cal, glenbrooks).filter(
    (r) => events.has(r.event) && !r.partialNames && HS_ALL_TIME_POINTS[r.place] !== undefined,
  )
  // Teams bucketed by event, school and surnames; within a bucket a row joins
  // the team whose debaters it names, allowing for dropped first or middle
  // names (sameHsDebater), so a name variant doesn't split one team in two.
  const teams = new Map<string, Building[]>()
  const bucketKey = (event: string, schoolKey: string, names: string[]) =>
    `${event}|${schoolKey}|${names.map((name) => nameKey(lastWord(name))).sort().join("+")}`
  /** `names` in `team`'s order, or `null` when they aren't the same debaters. */
  const pairUp = (team: Building, names: string[]): string[] | null => {
    if (team.names.length !== names.length) return null
    const left = [...names]
    const ordered: string[] = []
    for (const known of team.names) {
      const i = left.findIndex((name) => sameHsDebater(known, name))
      if (i < 0) return null
      ordered.push(left.splice(i, 1)[0])
    }
    return ordered
  }
  const add = (team: Omit<Building, "finishes" | "spellings">, finish: HsAllTimeFinish) => {
    const key = bucketKey(team.event, team.schoolKey, team.names)
    const bucket = teams.get(key) ?? []
    teams.set(key, bucket)
    let existing: Building | undefined
    for (const candidate of bucket) {
      const ordered = pairUp(candidate, team.names)
      if (!ordered) continue
      existing = candidate
      ordered.forEach((name, i) => {
        if (!candidate.spellings[i].includes(name)) candidate.spellings[i].push(name)
        // Show the fullest spelling.
        if (givenNames(name).length > givenNames(candidate.names[i]).length) candidate.names[i] = name
      })
      break
    }
    if (!existing) {
      existing = { ...team, names: [...team.names], spellings: team.names.map((name) => [name]), finishes: [] }
      bucket.push(existing)
    }
    if (!/\([A-Z]{2}\)/.test(existing.sourceSchool) && /\([A-Z]{2}\)/.test(team.sourceSchool)) {
      existing.sourceSchool = team.sourceSchool
      existing.school = team.school
    }
    existing.finishes.push(finish)
  }

  // Team finishes first, so speaker awards can find the pair they belong to.
  const speakers: Source[] = []
  for (const r of rows) {
    if (r.place === "Top speaker") {
      speakers.push(r)
      continue
    }
    const names = splitNames(r.competitors)
    if (!names.length) continue
    const schoolKey = tocSchoolKey(r.school)
    add(
      { event: r.event as HsAllTimeEvent, school: withoutState(r.school), sourceSchool: r.school, schoolKey, names },
      { tournament: r.tournament, year: r.year, place: r.place, points: hsAllTimeFinishPoints(r.place, r.year) },
    )
  }
  for (const r of speakers) {
    const [speaker] = splitNames(r.competitors)
    if (!speaker) continue
    const schoolKey = tocSchoolKey(r.school)
    const finish = { tournament: r.tournament, year: r.year, place: r.place, points: hsAllTimeFinishPoints(r.place, r.year) }
    // The pair this speaker debated in that year, at that school.
    const pair = [...teams.values()].flat().find(
      (team) =>
        team.event === r.event &&
        team.schoolKey === schoolKey &&
        team.names.some((name) => sameHsDebater(name, speaker)) &&
        team.finishes.some((f) => f.year === r.year),
    )
    if (pair) {
      pair.finishes.push(finish)
    } else if (r.event === "Lincoln-Douglas") {
      add(
        { event: "Lincoln-Douglas", school: withoutState(r.school), sourceSchool: r.school, schoolKey, names: [speaker] },
        finish,
      )
    }
    // A pair event's speaker with no recorded finish that year: their pair is unknown, so it isn't credited.
  }

  const out = Object.fromEntries(HS_ALL_TIME_EVENTS.map((event) => [event, [] as HsAllTimeTeam[]])) as Record<
    HsAllTimeEvent,
    HsAllTimeTeam[]
  >
  for (const team of [...teams.values()].flat()) {
    const finishes = [...team.finishes].sort((a, b) => a.year - b.year)
    const finishYears = finishes.map((f) => f.year)
    const years = { firstYear: Math.min(...finishYears), lastYear: Math.max(...finishYears) }
    const nationals = round2(finishes.reduce((sum, f) => sum + f.points, 0))
    const collegeRecords: HsAllTimeCollege[] =
      college || participation
        ? team.names
            .map((debater, i): HsAllTimeCollege | null => {
              // Any spelling the sources used; the college sources may know only one.
              const spellings = [debater, ...team.spellings[i]]
              const ndt = college ? (spellings.map(college).find(Boolean) ?? null) : null
              const listed = ndt || !participation ? null : (spellings.map((name) => participation(name, years)).find(Boolean) ?? null)
              if (!ndt && !listed) return null
              const collegePoints = ndt?.points ?? 0
              return {
                debater,
                school: ndt?.school ?? listed?.school ?? "",
                collegePoints,
                participationPoints: HS_ALL_TIME_PARTICIPATION_POINTS,
                participation: ndt ? "ndt" : "results",
                credit: round2((collegePoints + HS_ALL_TIME_PARTICIPATION_POINTS) * HS_ALL_TIME_COLLEGE_SHARE),
              }
            })
            .filter((record): record is HsAllTimeCollege => record !== null)
            .sort((a, b) => b.credit - a.credit)
        : []
    const collegeCredit = round2(collegeRecords.reduce((sum, r) => sum + r.credit, 0))
    out[team.event].push({
      rank: 0,
      event: team.event,
      school: team.school,
      schoolKey: team.schoolKey,
      sourceSchool: team.sourceSchool,
      debaters: team.names.join(" & "),
      lastNames: team.names.map(lastWord).join(" & "),
      firstYear: years.firstYear,
      lastYear: years.lastYear,
      total: round2(nationals + collegeCredit),
      nationals,
      collegeCredit,
      titles: finishes.filter((f) => f.place === "Champion" || f.place === "Co-champion").length,
      finishes,
      college: collegeRecords,
      notes: [],
    })
  }
  for (const event of HS_ALL_TIME_EVENTS) {
    out[event] = foldExtraPartnerships(out[event])
    const list = out[event]
    list.sort((a, b) => b.total - a.total || b.titles - a.titles || b.lastYear - a.lastYear)
    list.forEach((team, i) => {
      team.rank = i > 0 && list[i - 1].total === team.total ? list[i - 1].rank : i + 1
    })
  }
  return out
}

/**
 * Keeps at most {@link HS_ALL_TIME_MAX_PARTNERSHIPS} rows per debater; later
 * partnerships' high school points split across the kept rows with a footnote
 * naming the alt partner. College credit is left alone (already on each row).
 */
export function foldExtraPartnerships(teams: HsAllTimeTeam[]): HsAllTimeTeam[] {
  if (teams.length <= HS_ALL_TIME_MAX_PARTNERSHIPS) return teams
  const namesOf = (team: HsAllTimeTeam) =>
    team.debaters
      .split(" & ")
      .map((name) => name.trim())
      .filter(Boolean)
  const working = teams.map((team) => ({
    ...team,
    finishes: [...team.finishes],
    college: [...team.college],
    notes: [...team.notes],
  }))
  const drop = new Set<number>()

  for (;;) {
    let liveIndexes: number[] | null = null
    for (let i = 0; i < working.length; i++) {
      if (drop.has(i)) continue
      for (const name of namesOf(working[i])) {
        const matches: number[] = []
        for (let j = 0; j < working.length; j++) {
          if (drop.has(j)) continue
          if (working[j].schoolKey !== working[i].schoolKey) continue
          if (namesOf(working[j]).some((other) => sameHsDebater(other, name))) matches.push(j)
        }
        if (matches.length > HS_ALL_TIME_MAX_PARTNERSHIPS) {
          liveIndexes = matches
          break
        }
      }
      if (liveIndexes) break
    }
    if (!liveIndexes) break

    liveIndexes.sort(
      (a, b) =>
        working[b].total - working[a].total ||
        working[b].titles - working[a].titles ||
        working[b].lastYear - working[a].lastYear,
    )
    const keep = liveIndexes.slice(0, HS_ALL_TIME_MAX_PARTNERSHIPS)
    for (const extraIndex of liveIndexes.slice(HS_ALL_TIME_MAX_PARTNERSHIPS)) {
      const extra = working[extraIndex]
      const extraNames = namesOf(extra)
      const shared = extraNames.find((name) =>
        keep.some((i) => namesOf(working[i]).some((other) => sameHsDebater(other, name))),
      )
      const altPartner =
        extraNames.find((name) => !shared || !sameHsDebater(name, shared)) ?? extraNames[0] ?? "alt partner"
      const foldPoints = round2(extra.nationals / keep.length)
      for (const keepIndex of keep) {
        const row = working[keepIndex]
        row.nationals = round2(row.nationals + foldPoints)
        row.total = round2(row.nationals + row.collegeCredit)
        for (const finish of extra.finishes) {
          const note = `${finish.year} ${finish.tournament} ${finish.place} — with ${altPartner}`
          if (!row.notes.includes(note)) row.notes.push(note)
        }
      }
      drop.add(extraIndex)
    }
  }

  return working
    .filter((_, i) => !drop.has(i))
    .map((team) => ({ ...team, notes: [...team.notes].sort() }))
}

let cached: Record<HsAllTimeEvent, HsAllTimeTeam[]> | null = null

/** {@link buildHsAllTimeTeams} over the bundled histories, without college records, built once. */
export function hsAllTimeTeams(): Record<HsAllTimeEvent, HsAllTimeTeam[]> {
  cached ??= buildHsAllTimeTeams()
  return cached
}

let loading: Promise<Record<HsAllTimeEvent, HsAllTimeTeam[]>> | null = null

/**
 * {@link buildHsAllTimeTeams} with every debater's college record (NDT points
 * and College Debate Results participation), once the bundled NDT history has
 * loaded (shared with the college all-seasons table).
 */
export function loadHsAllTimeTeams(): Promise<Record<HsAllTimeEvent, HsAllTimeTeam[]>> {
  loading ??= import("./ndtAllTimeRanks")
    .then(({ loadNdtAllSeasonsTable }) => loadNdtAllSeasonsTable())
    .then(async ({ table }) => {
      const results = await import("../../../data/college-results-participants.json")
      return buildHsAllTimeTeams({
        college: collegeLookupFromNdt(table),
        participation: participationLookupFromResults(results.default as CollegeParticipant[]),
      })
    })
    .catch((error) => {
      loading = null
      throw error
    })
  return loading
}

/**
 * The {@link tocSchoolKey} a school page's name resolves to among the
 * schools with all-time teams, by the TOC record's matching rules (exact
 * key or alias, state tag must agree), or `null`.
 *
 * @param school - School name as the rankings or a school page spell it.
 * @param lists - The all-time lists to look in.
 */
export function hsAllTimeSchoolKey(
  school: string,
  lists: Record<HsAllTimeEvent, HsAllTimeTeam[]> = hsAllTimeTeams(),
): string | null {
  // One name per school, preferring a spelling with its state tag.
  const bySchool = new Map<string, { school: string; key: string }>()
  for (const list of Object.values(lists)) {
    for (const team of list) {
      const seen = bySchool.get(team.schoolKey)
      if (!seen || (!/\([A-Z]{2}\)/.test(seen.school) && /\([A-Z]{2}\)/.test(team.sourceSchool))) {
        bySchool.set(team.schoolKey, { school: team.sourceSchool, key: team.schoolKey })
      }
    }
  }
  return matchTocSchool(school, [...bySchool.values()])?.key ?? null
}
