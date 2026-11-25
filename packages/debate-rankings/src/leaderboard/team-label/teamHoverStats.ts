/**
 * @fileoverview What a team's hover card ({@link TeamHoverCard}) says about
 * it, worked out from whatever the caller already knows (the team's code,
 * school, last names, its rankings row) plus the all-time tables loaded on
 * first hover: the code to look the team up by, its high school all-time
 * entry, and the badges across the card's top.
 * @module leaderboard/team-label/teamHoverStats
 */

import { entryInitials, parseTeamLabel, schoolLevel } from "../../team-lookup"
import type { NdtTeamAllTimeRanks } from "../profile/ndtAllTimeRanks"
import { hsAllTimeSchoolKey, type HsAllTimeEvent, type HsAllTimeTeam } from "../profile/hsAllTimeTeams"
import type { TeamRankingRow } from "./TeamLabel"

/** What the hover card is told about a team. */
export interface TeamHoverQuery {
  /** The team as a video or tournament names it, e.g. `"Harker LL"`. */
  label?: string | null
  /** School, as the label shows it. */
  school?: string | null
  /** Last names (`"Le & Luo"`) or initials (`"LL"`). */
  debaters?: string | null
  /** The team's rankings row, when the caller found one. */
  ranking?: TeamRankingRow | null
  /** Year of the round the team is shown for, to tell apart pairs who share initials. */
  year?: number | null
}

/** Pairs this many years from the round's are someone else. */
const MAX_YEAR_GAP = 4

/** `"MV"` and `"VM"` name the same pair. */
const sortedLetters = (code: string) => [...code.toUpperCase()].sort().join("")

/**
 * The team as `"<school> <initials>"`, the shape the all-time lookups take:
 * the caller's own code when it has one, else the school and the initials of
 * the rankings row's (or the label's) debaters. `null` when neither is known.
 */
export function teamHoverCode(query: TeamHoverQuery): string | null {
  const label = query.label?.trim()
  if (label && parseTeamLabel(label)) return label
  const school = query.ranking?.school?.trim() || query.school?.trim() || label
  const names = query.ranking?.name?.trim() || query.debaters?.trim()
  if (!school || !names) return null
  const code = /^[A-Z]{1,4}$/.test(names) ? names : entryInitials(names)
  return code ? `${school} ${code}` : null
}

/**
 * The year the card should read the team's all-time records near: the
 * caller's round year, else a past rankings row's season, else none (the
 * best pair with those initials).
 */
export function teamHoverYear(query: TeamHoverQuery): number | null {
  if (typeof query.year === "number") return query.year
  if (typeof query.ranking?.season === "number") return query.ranking.season
  return null
}

/**
 * The team's entry in the high school all-time lists (TOC, NDCA, Barkley and
 * Cal finishes), or `null`. The school is matched by the TOC record's rules,
 * then the pair by its initials in either order; with a `year`, a pair more
 * than four years off is skipped and the nearest wins. Across events the best
 * rank wins. A college school is never looked up.
 *
 * @param lists - The all-time lists, e.g. from `loadHsAllTimeTeams`.
 * @param query - The team.
 */
export function findHsAllTimeTeam(
  lists: Record<HsAllTimeEvent, HsAllTimeTeam[]>,
  query: TeamHoverQuery,
): HsAllTimeTeam | null {
  const parsed = parseTeamLabel(teamHoverCode(query))
  if (!parsed) return null
  const school = query.ranking?.school?.trim() || query.school?.trim() || parsed.school
  if (schoolLevel(school) === "college") return null
  const key = hsAllTimeSchoolKey(school, lists) ?? hsAllTimeSchoolKey(parsed.school, lists)
  if (!key) return null
  const code = sortedLetters(parsed.code)
  const year = teamHoverYear(query)
  const gap = (team: HsAllTimeTeam) =>
    year === null ? 0 : year < team.firstYear ? team.firstYear - year : year > team.lastYear ? year - team.lastYear : 0
  let best: HsAllTimeTeam | null = null
  for (const list of Object.values(lists)) {
    for (const team of list) {
      if (team.schoolKey !== key) continue
      if (sortedLetters(entryInitials(team.lastNames)) !== code) continue
      if (gap(team) > MAX_YEAR_GAP) continue
      if (!best || gap(team) < gap(best) || (gap(team) === gap(best) && team.rank < best.rank)) best = team
    }
  }
  return best
}

/** One badge across the top of the hover card. */
export interface TeamHoverBadge {
  /** Short text, e.g. `"🎖️ #3 NDT team all time"`. */
  label: string
  /** Longer hover text. */
  title?: string
  /** `gold` for the top honors, `side` in the team's color, `muted` otherwise. */
  tone: "gold" | "side" | "muted"
}

/** Ranks at or under this in the all-time tables earn the 🎖️ GOAT badge. */
export const GOAT_ALL_TIME_RANK = 25

/**
 * The card's badges, best first: #1 / top 10 / top 25 this season, the
 * Greatest of All Time medal for a pair in the all-time top
 * {@link GOAT_ALL_TIME_RANK} (NDT or high school), national titles, TOC bids
 * and a strong elim record.
 */
export function teamHoverBadges({
  ranking,
  ndt,
  hs,
}: {
  ranking?: TeamRankingRow | null
  ndt?: NdtTeamAllTimeRanks | null
  hs?: HsAllTimeTeam | null
}): TeamHoverBadge[] {
  const badges: TeamHoverBadge[] = []
  const rank = typeof ranking?.rank === "number" ? ranking.rank : null
  const season = typeof ranking?.season === "number" ? ` in ${ranking.season - 1}-${String(ranking.season % 100).padStart(2, "0")}` : ""
  if (rank === 1) badges.push({ label: "👑 #1 team", title: `Ranked first${season || " this season"}`, tone: "gold" })
  else if (rank !== null && rank <= 10) badges.push({ label: "Top 10", title: `Ranked #${rank}${season || " this season"}`, tone: "side" })
  else if (rank !== null && rank <= 25) badges.push({ label: "Top 25", title: `Ranked #${rank}${season || " this season"}`, tone: "muted" })

  const ndtTeam = ndt?.team
  if (ndtTeam && ndtTeam.rank <= GOAT_ALL_TIME_RANK)
    badges.push({ label: `🎖️ GOAT #${ndtTeam.rank}`, title: `#${ndtTeam.rank} of ${ndtTeam.of} NDT teams of all time`, tone: "gold" })
  const bestDebater = ndt?.debaters.reduce<typeof ndt.debaters[number] | null>((b, d) => (!b || d.rank < b.rank ? d : b), null)
  if (bestDebater && bestDebater.rank <= GOAT_ALL_TIME_RANK && !(ndtTeam && ndtTeam.rank <= GOAT_ALL_TIME_RANK))
    badges.push({ label: `🎖️ GOAT debater #${bestDebater.rank}`, title: `${bestDebater.name}: #${bestDebater.rank} of ${bestDebater.of} NDT debaters of all time`, tone: "gold" })
  if (hs && hs.rank <= GOAT_ALL_TIME_RANK)
    badges.push({ label: `🎖️ GOAT #${hs.rank} HS`, title: `#${hs.rank} all-time high school ${hs.event} team`, tone: "gold" })
  if (hs && hs.titles > 0)
    badges.push({ label: `🏆 ${hs.titles} title${hs.titles === 1 ? "" : "s"}`, title: "National titles (TOC, NDCA, Barkley, Cal)", tone: "gold" })

  const bids = ranking?.tocBids?.length ?? 0
  if (bids > 0) badges.push({ label: `${bids} TOC bid${bids === 1 ? "" : "s"}`, tone: "side" })
  const elim = [ranking?.affElimWinRate, ranking?.negElimWinRate].filter((r): r is number => typeof r === "number")
  if (elim.length && Math.min(...elim) >= 70) badges.push({ label: "Elim closer", title: "Wins at least 70% of elims on both sides", tone: "muted" })
  return badges
}
