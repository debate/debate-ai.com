/**
 * @fileoverview Top speaker awards on the Greatest of All Time team lists: each
 * debater's speaker awards, shown inline on the rows of the teams they debated
 * on ({@link hsTeamSpeakers}, {@link ndtTeamSpeakers}), ranked per format.
 * It reuses the speaker data the team lists already score: TOC, NDCA,
 * Barkley Forum, Cal Invitational and Glenbrooks top speakers (plus the TOC's
 * and NDCA's lower speaker places) for the high school events
 * ({@link buildHsTopSpeakers}), and the NDT's published speaker awards for
 * College Policy ({@link buildNdtTopSpeakers}).
 *
 * Ranking: most top speaker (first place) awards, then most speaker points
 * (every speaker place scored by the same tiers the all-time lists use, so a
 * run of 2nd–5th places breaks a tie), then the most different tournaments,
 * then the most recent award, then name. Debaters with every key equal share a rank.
 *
 * A debater is one name at one school: high school spellings go through
 * {@link sameHsDebater} (a source that drops a middle name still matches), NDT
 * names match on their slug. A debater who changed schools appears once per
 * school. Rows a source names only by surname or team code are skipped, and a
 * format with no awards gets no list.
 * @module leaderboard/profile/topSpeakers
 */

import { BARKLEY_RESULTS, type BarkleyResult } from "../../sync/barkley-champions"
import { CAL_RESULTS, type CalResult } from "../../sync/berkeley-champions"
import { GLENBROOKS_RESULTS, type GlenbrooksResult } from "../../sync/glenbrooks-champions"
import { NDCA_HISTORY, ndcaEvent, ordinal, type NdcaResult } from "../../sync/ndca-champions"
import type { NdtSchoolHistory } from "../../sync/ndt-school-history"
import { TOC_HISTORY, tocSchoolKey, type TocResult } from "../../sync/toc-champions"
import {
  HS_ALL_TIME_EVENTS,
  sameHsDebater,
  splitNames,
  type HsAllTimeEvent,
  type HsAllTimeTeam,
} from "./hsAllTimeTeams"
import { cleanTeamName, hsNdcaPoints, hsTocPoints } from "./ndtAllSeasons"
import { speakerPoints } from "./programStrength"
import { profileSlug } from "./rankingProfileHelpers"

/** Where a speaker award was won. */
export type SpeakerTournament = "TOC" | "NDCA" | "Barkley" | "Cal" | "Glenbrooks" | "NDT"

/** One speaker award. */
export interface SpeakerAward {
  tournament: SpeakerTournament
  year: number
  /** Speaker place, 1 for the top speaker. */
  rank: number
  /** `"Top speaker"`, `"2nd speaker"`. */
  label: string
  /** The award's speaker points, the tie-break below top speaker awards. */
  points: number
}

/** One debater with speaker awards. */
export interface TopSpeaker {
  /** 1-based; debaters equal on every ranking key share a rank. */
  rank: number
  /** The debater's fullest spelling. */
  name: string
  /** The school as the source names it, without a state tag. */
  school: string
  /** The school's key in the source's history, to match a team row's school. */
  schoolKey: string
  /** First place awards: what the list ranks on. */
  topSpeakerAwards: number
  /** Speaker points over every award, the first tie-break. */
  points: number
  tournaments: SpeakerTournament[]
  firstYear: number
  lastYear: number
  /** Every award, oldest first. */
  awards: SpeakerAward[]
}

const label = (rank: number) => (rank === 1 ? "Top speaker" : `${ordinal(rank)} speaker`)

const withoutState = (school: string) => school.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim()
const givenCount = (name: string) => name.trim().split(/\s+/).length

interface Draft {
  name: string
  school: string
  schoolKey: string
  awards: SpeakerAward[]
}

/** Ranks `drafts` best first (the top `limit` when given), equal debaters sharing a rank. */
function rankSpeakers(drafts: Draft[], limit = Infinity): TopSpeaker[] {
  const rows = drafts.map((draft) => {
    const awards = [...draft.awards].sort((a, b) => a.year - b.year || a.rank - b.rank || a.tournament.localeCompare(b.tournament))
    const years = awards.map((award) => award.year)
    return {
      rank: 0,
      name: draft.name,
      school: draft.school,
      schoolKey: draft.schoolKey,
      topSpeakerAwards: awards.filter((award) => award.rank === 1).length,
      points: awards.reduce((sum, award) => sum + award.points, 0),
      tournaments: [...new Set(awards.map((award) => award.tournament))],
      firstYear: Math.min(...years),
      lastYear: Math.max(...years),
      awards,
    } satisfies TopSpeaker
  })
  rows.sort(
    (a, b) =>
      b.topSpeakerAwards - a.topSpeakerAwards ||
      b.points - a.points ||
      b.tournaments.length - a.tournaments.length ||
      b.lastYear - a.lastYear ||
      a.name.localeCompare(b.name),
  )
  const sameKeys = (a: TopSpeaker, b: TopSpeaker) =>
    a.topSpeakerAwards === b.topSpeakerAwards &&
    a.points === b.points &&
    a.tournaments.length === b.tournaments.length &&
    a.lastYear === b.lastYear
  rows.forEach((row, i) => {
    row.rank = i > 0 && sameKeys(rows[i - 1], row) ? rows[i - 1].rank : i + 1
  })
  return rows.slice(0, limit).filter((row) => row.topSpeakerAwards > 0 || row.points > 0)
}

type HsSource = {
  tournament: Exclude<SpeakerTournament, "NDT">
  event: string
  year: number
  place: string
  rank?: number
  school: string
  competitors: string
  partialNames?: boolean
}

/** Inputs to {@link buildHsTopSpeakers}; each defaults to the bundled history. */
export interface HsTopSpeakerSources {
  toc?: readonly TocResult[]
  ndca?: readonly NdcaResult[]
  barkley?: readonly BarkleyResult[]
  cal?: readonly CalResult[]
  glenbrooks?: readonly GlenbrooksResult[]
  limit?: number
}

function hsAwardPoints(source: HsSource): number {
  if (source.tournament === "TOC") return hsTocPoints({ place: source.place as TocResult["place"], rank: source.rank })
  if (source.tournament === "NDCA") return hsNdcaPoints({ place: source.place as NdcaResult["place"], rank: source.rank })
  return hsTocPoints({ place: "Top speaker" })
}

/**
 * The top speakers of each high school event: Policy, Lincoln-Douglas and
 * Public Forum, from the TOC, NDCA, Barkley Forum, Cal Invitational and
 * Glenbrooks. An event with no awards is left out.
 */
export function buildHsTopSpeakers(input: HsTopSpeakerSources = {}): Partial<Record<HsAllTimeEvent, TopSpeaker[]>> {
  const {
    toc = TOC_HISTORY,
    ndca = NDCA_HISTORY,
    barkley = BARKLEY_RESULTS,
    cal = CAL_RESULTS,
    glenbrooks = GLENBROOKS_RESULTS,
    limit,
  } = input
  const sources: HsSource[] = [
    ...toc.map((r) => ({ tournament: "TOC" as const, ...r })),
    ...ndca.map((r) => ({ tournament: "NDCA" as const, ...r, event: ndcaEvent(r) })),
    ...barkley.map((r) => ({ tournament: "Barkley" as const, ...r })),
    ...cal.map((r) => ({ tournament: "Cal" as const, ...r })),
    ...glenbrooks.map((r) => ({ tournament: "Glenbrooks" as const, ...r })),
  ]
  const events = new Set<string>(HS_ALL_TIME_EVENTS)
  const byEvent = new Map<HsAllTimeEvent, Draft[]>()
  for (const source of sources) {
    if (!events.has(source.event) || source.partialNames) continue
    const rank = source.place === "Top speaker" ? 1 : source.place === "Speaker" ? source.rank : undefined
    if (!rank) continue
    const schoolKey = tocSchoolKey(source.school)
    const event = source.event as HsAllTimeEvent
    const drafts = byEvent.get(event) ?? []
    byEvent.set(event, drafts)
    const award: SpeakerAward = {
      tournament: source.tournament,
      year: source.year,
      rank,
      label: label(rank),
      points: hsAwardPoints(source),
    }
    // A shared award (the 1972 TOC's two top speakers) credits each named debater.
    for (const name of splitNames(source.competitors)) {
      let draft = drafts.find((d) => d.schoolKey === schoolKey && sameHsDebater(d.name, name))
      if (!draft) {
        draft = { name, school: withoutState(source.school), schoolKey, awards: [] }
        drafts.push(draft)
      }
      if (givenCount(name) > givenCount(draft.name)) draft.name = name
      if (!draft.awards.some((a) => a.tournament === award.tournament && a.year === award.year && a.rank === award.rank)) {
        draft.awards.push(award)
      }
    }
  }
  const out: Partial<Record<HsAllTimeEvent, TopSpeaker[]>> = {}
  for (const event of HS_ALL_TIME_EVENTS) {
    const drafts = byEvent.get(event)
    if (!drafts?.length) continue
    const list = rankSpeakers(drafts, limit)
    if (list.length) out[event] = list
  }
  return out
}

let cachedHs: Partial<Record<HsAllTimeEvent, TopSpeaker[]>> | null = null

/** {@link buildHsTopSpeakers} over the bundled histories, built once. */
export function hsTopSpeakers(): Partial<Record<HsAllTimeEvent, TopSpeaker[]>> {
  cachedHs ??= buildHsTopSpeakers()
  return cachedHs
}

const bySchoolIndexes = new WeakMap<readonly TopSpeaker[], Map<string, TopSpeaker[]>>()

function speakersAtSchool(speakers: readonly TopSpeaker[], schoolKey: string): TopSpeaker[] {
  let index = bySchoolIndexes.get(speakers)
  if (!index) {
    index = new Map()
    for (const speaker of speakers) index.set(speaker.schoolKey, [...(index.get(speaker.schoolKey) ?? []), speaker])
    bySchoolIndexes.set(speakers, index)
  }
  return index.get(schoolKey) ?? []
}

/**
 * The speaker awards of the debaters on a high school all-time team, in the
 * list's ranking order (most top speaker awards, then speaker points,
 * tournaments, most recent award). A debater without awards is left out.
 *
 * @param speakers - The event's speakers ({@link hsTopSpeakers}`()[event]`).
 * @param team - The team's school key and debaters (`"A & B"`).
 */
export function hsTeamSpeakers(
  speakers: readonly TopSpeaker[] | null | undefined,
  team: Pick<HsAllTimeTeam, "schoolKey" | "debaters">,
): TopSpeaker[] {
  if (!speakers?.length) return []
  const names = team.debaters.split(" & ")
  return speakersAtSchool(speakers, team.schoolKey).filter((speaker) => names.some((name) => sameHsDebater(name, speaker.name)))
}

/**
 * The speaker awards of the debaters on an NDT team (or of one debater), in
 * the list's ranking order. A debater without awards is left out.
 *
 * @param speakers - The NDT's speakers ({@link buildNdtTopSpeakers}).
 * @param row - The row's NDT school and debaters (`"A B & C D"`, or one name).
 */
export function ndtTeamSpeakers(
  speakers: readonly TopSpeaker[] | null | undefined,
  row: { school: string; team: string },
): TopSpeaker[] {
  if (!speakers?.length || !row.team) return []
  const slugs = cleanTeamName(row.team)
    .split(/\s*(?:&|\/| and )\s*/i)
    .map((name) => profileSlug(name))
    .filter(Boolean)
  return speakersAtSchool(speakers, row.school).filter((speaker) => slugs.includes(profileSlug(speaker.name)))
}

/**
 * The top NDT speakers of all time, from each school's published speaker
 * awards (the top 20 speakers of every NDT since 1948). Empty when the history has none.
 *
 * @param history - The NDT school history.
 * @param limit - How many debaters to list; all by default.
 */
export function buildNdtTopSpeakers(history: readonly NdtSchoolHistory[], limit?: number): TopSpeaker[] {
  const drafts = new Map<string, Draft>()
  for (const school of history) {
    for (const award of school.speakerAwards) {
      const slug = profileSlug(award.speaker)
      if (!slug) continue
      const key = `${school.school}|${slug}`
      const draft = drafts.get(key) ?? { name: award.speaker, school: school.school, schoolKey: school.school, awards: [] }
      drafts.set(key, draft)
      const rank = award.rank ?? 20
      draft.awards.push({ tournament: "NDT", year: award.year, rank, label: label(rank), points: speakerPoints(rank) })
    }
  }
  return rankSpeakers([...drafts.values()], limit)
}
