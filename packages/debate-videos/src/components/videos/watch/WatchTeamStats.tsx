/**
 * @fileoverview The two teams of a round on its watch page: each team's
 * rankings row (rank, rating, matches, side win rates) and its radar chart,
 * with the opponent overlaid as a dashed polygon so the matchup reads at a
 * glance, and the team's school average in that division as a dotted one (on
 * by default, toggled under the radar). Whenever either team is found, in
 * this season or a past one, a simulated matchup above the cards predicts the
 * winner for the sides they debated and the round's stage (see
 * `WatchMatchupPrediction`); a team no source names plays as a stand-in.
 * Renders nothing unless at least one team is found.
 *
 * The lookup is the one the list layout's Aff and Neg cells use: a
 * current-season round of a ranked style is matched in the current rankings
 * (see `isRankedSeasonRound`), since a past season's team code names other
 * people. A past-season round's team is matched in that season's own rows
 * instead (debatedata's table for college policy, the school's best entries
 * for high school), and its card shows that season's numbers.
 *
 * Every card starts with the school's mascot when debate-icons has one
 * (`getSchoolMascot`, colleges only so far) and ends with the team's other
 * seasons, up to 15 back (see `lib/watch-team-history.ts`). For high school
 * those come from each season's full rankings around the round, so a team
 * shows every season it was ranked, at whichever school.
 * @module components/watch/WatchTeamStats
 */

"use client"

import { useEffect, useState, type ReactNode } from "react"
import {
  fetchSchoolSeasons,
  formatSiteRating,
  loadCollegeHistory,
  loadRankingDataset,
  parseTeamLabel,
  COLLEGE_HISTORY_FIRST_YEAR,
  type CollegeHistoryEntry,
  type RankingDataset,
  type RankingEntry,
  type RankingDatasetId,
  type SchoolSeason,
  type SchoolSeasonEvent,
} from "@debate-ai/rankings"
import { useAllRankingDatasets } from "@debate-ai/rankings/src/leaderboard/hooks/useAllRankingDatasets"
import { currentSeasonYear } from "@debate-ai/rankings/src/leaderboard/leaderboardUtils"
import { getSchoolMascot } from "@debate-ai/rankings/src/leaderboard/lib/schoolMascots"
import { useShowSchoolMascots } from "@debate-ai/rankings/src/leaderboard/lib/school-art-settings"
import { pastTeamHref } from "@debate-ai/rankings/src/leaderboard/profile/pastTeamHelpers"
import { isRankedSeasonRound } from "../../../hooks/useVideoTeamRankings"
import { pastCollegeSeason } from "../../../lib/video-team-ranks"
import {
  collegeTeamHistory,
  findCollegeRoundTeam,
  findHsRoundTeam,
  hsDatasetTeamHistory,
  hsHistorySeasons,
  hsSeasonEvent,
  hsTeamHistory,
  mergeTeamHistory,
  resolveRankedSchool,
  seasonLabel,
  TEAM_HISTORY_SEASONS,
  type HistoryTeam,
  type TeamSeasonStat,
} from "../../../lib/watch-team-history"
import {
  findSchoolDivisionEntries,
  findVideoTeamProfile,
  findVideoTeamRanking,
  videoStyleDatasetId,
  schoolDivisionRadarData,
  teamHref,
  teamRadarData,
  type ProfileEntry,
} from "@debate-ai/rankings/src/leaderboard/profile/rankingProfileHelpers"
import { TeamRadarChart, type RadarComparison } from "@debate-ai/rankings/src/leaderboard/profile/TeamRadarChart"
import { cn } from "../../../ui/lib/utils"
import {
  predictCollegeHistoryMatchup,
  predictWatchMatchup,
  standInEntry,
  type WatchMatchupPrediction as Prediction,
} from "../../../lib/watch-matchup-prediction"
import { WatchMatchupPrediction } from "./WatchMatchupPrediction"
import { TeamCodeLabel } from "@debate-ai/rankings/src/leaderboard/team-label/TeamLabel"
import type { VideoType } from "../../../types/videos"

const rating = (n: number) => n.toFixed(1)
const percent = (n: number | null) =>
  n === null ? "—" : `${Number.isInteger(n) ? n : n.toFixed(1)}%`

/** One labelled number in a team's stat grid. */
function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  )
}

/**
 * The school's mascot, large (up to 300px tall, near its full size) and
 * centred above a team's card, when debate-icons has one and the "Show school
 * mascots" setting is on. It shrinks to the card's width in the narrow sidebar.
 */
function SchoolMascot({ school }: { school: string }) {
  const show = useShowSchoolMascots()
  const src = show ? getSchoolMascot(school) : undefined
  if (!src) return null
  return (
    <div className="flex justify-center">
      <img
        src={src}
        alt={`${school} mascot`}
        width={274}
        height={200}
        loading="lazy"
        decoding="async"
        className="h-auto max-h-[300px] w-full max-w-[412px] object-contain drop-shadow-sm"
      />
    </div>
  )
}

/** The rank a season row reads as: `#4 of 312`, or `#4` in a top-100 table. */
function seasonRank(row: TeamSeasonStat): string {
  return row.fieldSize ? `#${row.rank} of ${row.fieldSize}` : `#${row.rank}`
}

/**
 * The team's past seasons, newest first: rank and rating for college
 * (debatedata's top 100), rank and TOC bids for high school. Renders nothing
 * when the sources hold no season for the team.
 */
function TeamHistoryTable({
  rows,
  college,
  currentSeason,
  schoolOf,
  compact = false,
}: {
  rows: readonly TeamSeasonStat[]
  college: boolean
  /** The season the card's own stats are from, marked in the list. */
  currentSeason: number | null
  /** The card's school; a season at another school names it. */
  schoolOf?: string
  /** Shorter scroll box, for the watch page's sidebar. */
  compact?: boolean
}) {
  if (rows.length === 0) return null
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold">Season history</h3>
        <span className="text-[10px] text-muted-foreground">
          {college ? `debatedata top 100 · last ${TEAM_HISTORY_SEASONS} seasons` : "every ranked entry"}
        </span>
      </div>
      <div className={cn("overflow-auto rounded-md border", compact ? "max-h-40" : "max-h-64")}>
        <table className="w-full text-xs tabular-nums">
          <thead className="sticky top-0 bg-muted/80 text-[10px] uppercase tracking-wide text-muted-foreground backdrop-blur">
            <tr>
              <th className="px-2 py-1 text-left font-medium">Season</th>
              <th className="px-2 py-1 text-left font-medium">Rank</th>
              {college ? (
                <>
                  <th className="px-2 py-1 text-right font-medium">Rating</th>
                  <th className="hidden px-2 py-1 text-right font-medium sm:table-cell">Mu ± σ</th>
                </>
              ) : (
                <th className="px-2 py-1 text-right font-medium">TOC bids</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.season}
                className={cn("border-t", row.season === currentSeason && "bg-primary/5 font-semibold")}
                title={row.name}
              >
                <td className="px-2 py-1">{seasonLabel(row.season)}</td>
                <td className="px-2 py-1">
                  {seasonRank(row)}
                  {row.school && schoolOf && row.school !== schoolOf && (
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">at {row.school}</span>
                  )}
                </td>
                {college ? (
                  <>
                    <td className="px-2 py-1 text-right">{row.rating?.toFixed(1) ?? "—"}</td>
                    <td className="hidden px-2 py-1 text-right sm:table-cell">
                      {row.mu !== undefined && row.sigma !== undefined ? `${row.mu.toFixed(1)} ± ${row.sigma.toFixed(1)}` : "—"}
                    </td>
                  </>
                ) : (
                  <td className="px-2 py-1 text-right">{row.bids ?? 0}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * A past-season round's team, found in that season's rows rather than the
 * current rankings: its mascot, that season's numbers, and its history.
 */
function PastSeasonTeamCard({
  label,
  school,
  stat,
  history,
  college,
  compact = false,
}: {
  label: string
  school: string
  stat: TeamSeasonStat
  history: readonly TeamSeasonStat[]
  college: boolean
  compact?: boolean
}) {
  return (
    <div className={cn("min-w-0 rounded-lg border bg-card", compact ? "p-2 space-y-2" : "p-3 space-y-3")}>
      <SchoolMascot school={school} />
      <header className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          {college ? (
            <a href={pastTeamHref({ school, name: stat.name })} className="font-semibold hover:underline">
              {label}
            </a>
          ) : (
            <span className="font-semibold">{label}</span>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{seasonLabel(stat.season)} season</span>
      </header>
      <div className={cn("grid gap-1.5", compact ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4")}>
        <Stat label={college ? "Rank of top 100" : `Rank of ${stat.fieldSize ?? "—"}`} value={`#${stat.rank}`} />
        {college ? (
          <>
            <Stat label="Rating" value={stat.rating?.toFixed(1) ?? "—"} />
            <Stat label="Mu" value={stat.mu?.toFixed(1) ?? "—"} />
            <Stat label="Sigma" value={stat.sigma !== undefined ? `±${stat.sigma.toFixed(1)}` : "—"} />
          </>
        ) : (
          <Stat label="TOC bids" value={stat.bids ?? 0} />
        )}
      </div>
      <TeamHistoryTable rows={history} college={college} currentSeason={stat.season} schoolOf={school} compact={compact} />
    </div>
  )
}

/** One team's card: mascot, name linking to its profile, its stats, its radar, its past seasons. */
function TeamCard({
  side,
  label,
  item,
  opponent,
  datasets,
  history,
  compact = false,
}: {
  side: "aff" | "neg"
  label: string
  item: ProfileEntry
  opponent: { label: string; item: ProfileEntry } | null
  datasets: RankingDataset[]
  history: readonly TeamSeasonStat[]
  compact?: boolean
}) {
  const { entry, fieldSize } = item
  const data = teamRadarData(item)
  const [showSchool, setShowSchool] = useState(true)
  const schoolItems = findSchoolDivisionEntries(datasets, item)
  const hasSchoolPeers = schoolItems.length > 1
  const comparisons: RadarComparison[] = []
  if (opponent) comparisons.push({ label: opponent.label, data: teamRadarData(opponent.item) })
  if (hasSchoolPeers && showSchool) {
    comparisons.push({
      label: `${entry.school} average (${schoolItems.length} teams)`,
      data: schoolDivisionRadarData(schoolItems),
    })
  }
  return (
    <div className={cn("min-w-0 rounded-lg border bg-card", compact ? "p-2 space-y-2" : "p-3 space-y-3")}>
      <SchoolMascot school={entry.school} />
      <header className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <TeamCodeLabel label={label} ranking={entry} side={side} href={teamHref(entry)} className="font-semibold" />
        </div>
      </header>
      <div className={cn("grid gap-1.5", compact ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4")}>
        <Stat label={`Rank of ${fieldSize}`} value={`#${entry.rank}`} />
        <Stat label="Rating" value={formatSiteRating(entry.adjustedRating)} />
        <Stat label="Deviation" value={`±${rating(entry.deviation)}`} />
        <Stat label="Matches" value={entry.matches} />
        <Stat label="Aff win" value={percent(entry.affWinRate)} />
        <Stat label="Neg win" value={percent(entry.negWinRate)} />
        <Stat label="Elim aff" value={percent(entry.affElimWinRate)} />
        <Stat label="Elim neg" value={percent(entry.negElimWinRate)} />
      </div>
      <TeamRadarChart
        data={data}
        caption={opponent ? `${label} vs ${opponent.label} (edge = best)` : `${label} (edge = best)`}
        ariaLabel={`${label} radar: ${data.map((d) => `${d.metric} ${d.display}`).join(", ")}`}
        comparison={comparisons}
        footer={
          hasSchoolPeers && (
            <label className="mt-1 flex cursor-pointer select-none items-center gap-1.5 px-1 text-xs text-muted-foreground hover:text-foreground">
              <input
                type="checkbox"
                checked={showSchool}
                onChange={(event) => setShowSchool(event.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer accent-primary"
              />
              Show {entry.school} average
            </label>
          )
        }
      />
      <TeamHistoryTable
        rows={history}
        college={item.datasetId === "cpd"}
        currentSeason={item.datasetId === "cpd" ? null : currentSeasonYear()}
        schoolOf={entry.school}
        compact={compact}
      />
    </div>
  )
}

/** Every college season debatedata has, loaded once `enabled`; empty until then. */
function useCollegeHistory(enabled: boolean, latest: number): ReadonlyMap<number, CollegeHistoryEntry[]> {
  const [history, setHistory] = useState<ReadonlyMap<number, CollegeHistoryEntry[]>>(() => new Map())
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const first = Math.max(COLLEGE_HISTORY_FIRST_YEAR, latest - TEAM_HISTORY_SEASONS + 1)
    const years = Array.from({ length: Math.max(0, latest - first + 1) }, (_, i) => first + i)
    Promise.all(years.map((year) => loadCollegeHistory(year).then((rows) => [year, rows] as const)))
      .then((pairs) => {
        if (!cancelled) setHistory(new Map(pairs.filter(([, rows]) => rows.length > 0)))
      })
      // Without the tables the cards just leave their history out.
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [enabled, latest])
  return history
}

/** Each named high school's finished seasons, loaded as the names arrive. */
function useSchoolSeasonsMap(schools: readonly string[]): ReadonlyMap<string, SchoolSeason[]> {
  const key = [...new Set(schools.filter(Boolean))].sort().join("\n")
  const [bySchool, setBySchool] = useState<ReadonlyMap<string, SchoolSeason[]>>(() => new Map())
  useEffect(() => {
    if (!key) return
    let cancelled = false
    for (const school of key.split("\n")) {
      fetchSchoolSeasons(school)
        .then(({ seasons }) => {
          if (!cancelled) setBySchool((prev) => new Map(prev).set(school, seasons))
        })
        // A school whose seasons fail to load just shows no history.
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
  }, [key])
  return bySchool
}

/**
 * The full rankings of each high school season in `years` for `datasetId`,
 * loaded as they arrive (one ratings file per season, shared for the visit);
 * a season that fails to load is left out.
 */
function useHsSeasonDatasets(datasetId: RankingDatasetId | null, years: readonly number[]): ReadonlyMap<number, RankingDataset> {
  const key = datasetId && years.length > 0 ? `${datasetId}|${years.join(",")}` : ""
  const [bySeason, setBySeason] = useState<{ key: string; seasons: ReadonlyMap<number, RankingDataset> }>(() => ({
    key: "",
    seasons: new Map(),
  }))
  useEffect(() => {
    if (!key) return
    let cancelled = false
    const [id, list] = key.split("|")
    for (const year of list.split(",").map(Number)) {
      loadRankingDataset(id as RankingDatasetId, year)
        .then((dataset) => {
          if (cancelled) return
          setBySeason((prev) => ({
            key,
            seasons: new Map(prev.key === key ? prev.seasons : []).set(year, dataset),
          }))
        })
        // Without that season the history falls back to the school's best entries.
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
  }, [key])
  return bySeason.key === key ? bySeason.seasons : EMPTY_SEASONS
}

const EMPTY_SEASONS: ReadonlyMap<number, RankingDataset> = new Map()

/** What one side of a past-season round resolved to. */
interface PastSideTeam {
  school: string
  stat: TeamSeasonStat
  history: TeamSeasonStat[]
  /** The team's row in that season's full high school rankings, for the simulated matchup. */
  entry?: RankingEntry
  /** The team's row in debatedata's table that season (college). */
  collegeRow?: CollegeHistoryEntry
}

/**
 * Stats and radar for the round's aff and neg teams, when the rankings know
 * them, or that season's numbers for a past-season round, each under its
 * school's mascot and above its past seasons. A team no source knows is left
 * out; with neither found the section is not rendered at all.
 *
 * @param props.video - The round being watched.
 * @param props.compact - Stack the cards in one narrow column (Aff above
 *   Neg) with a shorter history, for the watch page's
 *   sidebar.
 */
export function WatchTeamStats({ video, compact = false }: { video: VideoType; compact?: boolean }) {
  const affTeam = video[9]
  const negTeam = video[10]
  const hasTeams = Boolean(affTeam?.trim() || negTeam?.trim())
  const latest = currentSeasonYear()
  const datasetId = videoStyleDatasetId(video[6])
  const event: SchoolSeasonEvent | null = hsSeasonEvent(datasetId)
  const current = hasTeams && isRankedSeasonRound(video)
  const pastCollege = hasTeams && !current ? pastCollegeSeason(video) : null
  const roundSeason = typeof video[17] === "number" && video[17] > 0 ? video[17] : null
  const pastHs =
    hasTeams && !current && event !== null && roundSeason !== null && roundSeason < latest && roundSeason > latest - TEAM_HISTORY_SEASONS
      ? roundSeason
      : null

  const { datasets } = useAllRankingDatasets(current || pastHs !== null)
  const collegeHistory = useCollegeHistory(datasetId === "cpd" && (current || pastCollege !== null), latest)

  const aff = current && affTeam ? findVideoTeamProfile(datasets, video[6], affTeam) : null
  const neg = current && negTeam ? findVideoTeamProfile(datasets, video[6], negTeam) : null

  // High schools whose seasons the cards need: a current team's own school,
  // or the ranked school a past round's label names.
  const hsDataset = event ? datasets.find((d) => d.id === datasetId) : undefined
  const pastHsSchool = (label: string | null | undefined) =>
    pastHs !== null ? resolveRankedSchool(hsDataset, parseTeamLabel(label)?.school ?? "") : null
  const affHsSchool = event ? (aff?.entry.school ?? pastHsSchool(affTeam)) : null
  const negHsSchool = event ? (neg?.entry.school ?? pastHsSchool(negTeam)) : null
  const schoolSeasons = useSchoolSeasonsMap([affHsSchool ?? "", negHsSchool ?? ""])

  // Each high school season around the round, in full: the current season
  // from the rankings already loaded, the others fetched.
  const hsYears = event && (current || pastHs !== null) ? hsHistorySeasons(pastHs ?? latest, latest) : []
  const loadedHsSeasons = useHsSeasonDatasets(
    event ? datasetId : null,
    hsYears.filter((year) => year !== latest),
  )
  const hsSeasonData = new Map(loadedHsSeasons)
  if (hsYears.includes(latest) && hsDataset) hsSeasonData.set(latest, hsDataset)

  /** A high school team's seasons: every ranked one loaded, else the school's best two. */
  const hsHistory = (team: HistoryTeam, schoolRows: readonly SchoolSeason[] | undefined): TeamSeasonStat[] => {
    if (!event) return []
    const fallback = schoolRows ? hsTeamHistory(schoolRows, event, team.name, latest) : []
    return mergeTeamHistory(hsDatasetTeamHistory(hsSeasonData, team, latest), fallback)
  }

  const historyOf = (item: ProfileEntry | null): TeamSeasonStat[] => {
    if (!item) return []
    if (item.datasetId === "cpd") return collegeTeamHistory(collegeHistory, item.entry, latest)
    return hsHistory(item.entry, schoolSeasons.get(item.entry.school))
  }

  const pastSide = (label: string | null | undefined, hsSchool: string | null): PastSideTeam | null => {
    if (pastCollege !== null) {
      const entry = findCollegeRoundTeam(collegeHistory, pastCollege, label)
      if (!entry) return null
      const stat: TeamSeasonStat = {
        season: pastCollege,
        rank: entry.rank,
        fieldSize: null,
        name: entry.name,
        rating: entry.rating,
        mu: entry.mu,
        sigma: entry.sigma,
      }
      return { school: entry.school, stat, history: collegeTeamHistory(collegeHistory, entry, latest), collegeRow: entry }
    }
    if (pastHs !== null && event) {
      // That season's full rankings name any entry; the school's best two are the fallback.
      const seasonData = hsSeasonData.get(pastHs)
      const entry = seasonData && label?.trim() ? findVideoTeamRanking([seasonData], video[6], label) : null
      if (entry && seasonData) {
        const stat: TeamSeasonStat = {
          season: pastHs,
          rank: entry.rank,
          fieldSize: seasonData.entries.length,
          name: entry.name,
          bids: entry.tocBids?.length ?? 0,
          school: entry.school,
        }
        return { school: entry.school, stat, history: hsHistory(entry, schoolSeasons.get(entry.school)), entry }
      }
      const seasons = hsSchool ? schoolSeasons.get(hsSchool) : undefined
      const stat = seasons ? findHsRoundTeam(seasons, event, pastHs, label) : null
      if (!hsSchool || !seasons || !stat) return null
      // The school's season rows come from the same ratings file, so the rank names its row there.
      const row = seasonData?.entries.find((e) => e.rank === stat.rank && e.name === stat.name)
      return { school: hsSchool, stat, history: hsHistory({ school: hsSchool, name: stat.name }, seasons), entry: row }
    }
    return null
  }

  const affPast = current ? null : pastSide(affTeam, affHsSchool)
  const negPast = current ? null : pastSide(negTeam, negHsSchool)

  if (!hasTeams) return null

  const decision = typeof video[12] === "string" ? video[12] : null

  if (!current) {
    if (!affPast && !negPast) return null
    const college = pastCollege !== null
    let prediction: Prediction | null = null
    if (pastCollege !== null) {
      prediction = predictCollegeHistoryMatchup(
        affTeam?.trim() ? (affPast?.collegeRow ?? null) : null,
        negTeam?.trim() ? (negPast?.collegeRow ?? null) : null,
        collegeHistory.get(pastCollege) ?? [],
        pastCollege,
        video[8],
        video[11],
        video[0],
      )
      // A side with no label at all has nobody to stand in for.
      if (prediction?.standIn && !(prediction.standIn === "aff" ? affTeam : negTeam)?.trim()) prediction = null
    } else if (pastHs !== null) {
      const seasonData = hsSeasonData.get(pastHs)
      const sideEntry = (past: PastSideTeam | null, label: string | null | undefined, school: string | null) =>
        past?.entry ?? (seasonData && label?.trim() ? standInEntry(seasonData, label, past?.school ?? school) : null)
      const affEntry = sideEntry(affPast, affTeam, affHsSchool)
      const negEntry = sideEntry(negPast, negTeam, negHsSchool)
      if (seasonData && affEntry && negEntry && affEntry !== negEntry && (affPast?.entry || negPast?.entry)) {
        prediction = predictWatchMatchup(affEntry, negEntry, seasonData, [seasonData], video[8], video[11], video[0], pastHs)
      }
    }
    return (
      <section aria-label="Team stats" className="space-y-2">
        <h2 className="text-sm font-semibold">Team rankings</h2>
        {prediction && (
          <WatchMatchupPrediction
            prediction={prediction}
            affLabel={affTeam?.trim() || "Aff"}
            negLabel={negTeam?.trim() || "Neg"}
            decision={decision}
            videoId={video[0]}
          />
        )}
        <div className={cn("grid grid-cols-1 gap-3", !compact && affPast && negPast && "xl:grid-cols-2")}>
          {affPast && affTeam && <PastSeasonTeamCard label={affTeam} {...affPast} college={college} compact={compact} />}
          {negPast && negTeam && <PastSeasonTeamCard label={negTeam} {...negPast} college={college} compact={compact} />}
        </div>
      </section>
    )
  }

  if (datasets.length === 0 || (!aff && !neg)) return null
  // A team the rankings don't name plays as a stand-in at its school's strength.
  const found = (aff ?? neg)!
  const dataset = datasets.find((d) => d.id === found.datasetId)
  const standIn = (label: string | null | undefined) =>
    dataset && label?.trim() ? standInEntry(dataset, label, resolveRankedSchool(dataset, parseTeamLabel(label)?.school ?? "")) : null
  const affEntry = aff?.entry ?? standIn(affTeam)
  const negEntry = neg?.entry ?? standIn(negTeam)
  const prediction =
    affEntry && negEntry && dataset && affEntry !== negEntry
      ? predictWatchMatchup(affEntry, negEntry, dataset, datasets, video[8], video[11], video[0])
      : null

  return (
    <section aria-label="Team stats" className="space-y-2">
      <h2 className="text-sm font-semibold">Team rankings</h2>
      {prediction && affTeam && negTeam && (
        <WatchMatchupPrediction
          prediction={prediction}
          affLabel={<TeamCodeLabel label={affTeam} ranking={aff?.entry} side="aff" />}
          negLabel={<TeamCodeLabel label={negTeam} ranking={neg?.entry} side="neg" />}
          decision={decision}
          videoId={video[0]}
        />
      )}
      <div className={cn("grid grid-cols-1 gap-3", !compact && aff && neg && "xl:grid-cols-2")}>
        {aff && affTeam && (
          <TeamCard
            side="aff"
            label={affTeam}
            item={aff}
            opponent={neg && negTeam ? { label: negTeam, item: neg } : null}
            datasets={datasets}
            history={historyOf(aff)}
            compact={compact}
          />
        )}
        {neg && negTeam && (
          <TeamCard
            side="neg"
            label={negTeam}
            item={neg}
            opponent={aff && affTeam ? { label: affTeam, item: aff } : null}
            datasets={datasets}
            history={historyOf(neg)}
            compact={compact}
          />
        )}
      </div>
    </section>
  )
}
