/**
 * @fileoverview Ranking and leaderboard panel for debate teams.
 * Shows the live Elo rankings (with the bundled CSVs' aff/neg win
 * rates merged into the current season) for VPF, VLD, VCX and NDT (college
 * policy) from 2015-16 to now, with historical champion data,
 * plus a Schools tab that rolls every division's entries up by school.
 *
 * Delegates data loading to {@link useLeaderboardData}, the grid to
 * {@link RankingsTable} and filter UI to {@link LeaderboardFilterBar},
 * keeping this file focused on orchestration.
 * @module leaderboard/RankingsLeaderboardPanel
 */

"use client"

import { useState, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Search } from "lucide-react"
import {
  getRankingDatasetInfo,
  hasCollegeHistory,
  hasExtinctionSeason,
  type RankingDataset,
} from "../index"
import { TooltipProvider } from "./ui/primitives/tooltip"
import { Tabs, TabsList, TabsTrigger } from "./ui/primitives/tabs"
import { Input } from "./ui/primitives/input"
import {
  DIVISION_CONFIG,
  DIVISION_SHORT_LABELS,
  VALID_DIVISIONS,
  VALID_LEADERBOARD_VIEWS,
  currentSeasonYear,
  divisionDatasets,
  filterEntries,
  filterSchools,
  resolveDivisionTopic,
  schoolRankingsFor,
  schoolRanksByName,
  seasonYears,
  sortEntries,
  sortSchools,
  type Division,
  type LeaderboardView,
  type SchoolSortKey,
  type SchoolSortState,
  type SortKey,
  type SortState,
  type LeaderboardPanelProps,
} from "./leaderboardUtils"
import { useLeaderboardData } from "./hooks/useLeaderboardData"
import { useSchoolRankingsSnapshot } from "./hooks/useSchoolRankingsSnapshot"
import { usePreviousSeasonDataset } from "./hooks/usePreviousSeasonDataset"
import { useRankBaseline } from "./hooks/useRankBaseline"
import { rankBaselineTooltip } from "./rankBaseline"
import { buildRankChanges, buildTeamRankChanges, schoolRankChangeKey, teamRankChangeKey } from "./rankChange"
import { useTocBids } from "./hooks/useTocBids"
import { matchTocBids, rankedTeamKey, type TocBidTeam } from "../sync/sync-toc-bids-sheet"
import { SchoolRankingsTable } from "./SchoolRankingsTable"
import { NdtAllSeasonsSection } from "./profile/NdtAllSeasonsDialog"
import { HsEliteSchoolsSection, NdtEliteSchoolsSection } from "./profile/NdtEliteSchoolsChart"
import { LeaderboardChampionBanner } from "./LeaderboardChampionBanner"
import { RankingsTable } from "./RankingsTable"
import { legendaryCount } from "./rowTier"
import { RankingsFieldSummary } from "./RankingsFieldSummary"
import { LeaderboardFilterBar } from "./LeaderboardFilterBar"
import { CollegeHistoryTable } from "./CollegeHistoryTable"
import { ALL_TIME_SEASON, AllTimeRankingsView } from "./AllTimeRankingsView"
import type { SchoolSeasonEvent } from "../school-seasons"

/** The high school event each school-scope tab draws its Top 10 for. */
const HS_ELITE_EVENTS: Record<Exclude<Division, "NDT">, SchoolSeasonEvent> = {
  VCX: "Policy",
  VLD: "Lincoln-Douglas",
  VPF: "Public Forum",
}


/**
 * Full-page leaderboard panel.
 *
 * When no controlled props are provided the panel manages division/year state
 * internally and syncs the active division to the `?format=` URL query param.
 * When `controlledDivision` and `controlledYear` are provided the parent owns
 * those values and the internal filter UI is hidden.
 *
 * @param props - See {@link LeaderboardPanelProps}.
 */
export function LeaderboardPanel({
  controlledDivision,
  controlledView,
  controlledYear,
  onControlledDivisionChange,
  onControlledViewChange,
  onControlledYearChange,
  history,
}: LeaderboardPanelProps = {}) {
  const searchParams = useSearchParams()
  const router = useRouter()

  /** Reads the initial division from the `?format=` param on first render only. */
  const initialDivision = useMemo<Division>(() => {
    const f = searchParams.get("format")
    return f && VALID_DIVISIONS.has(f) ? (f as Division) : "VPF"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Reads the initial Teams/Schools toggle from `?by=` (or legacy `?format=SCHOOLS`) on first render only. */
  const initialView = useMemo<LeaderboardView>(() => {
    const by = searchParams.get("by")
    if (by && VALID_LEADERBOARD_VIEWS.has(by)) return by as LeaderboardView
    return searchParams.get("format") === "SCHOOLS" ? "schools" : "teams"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // Division / view / year state (controlled or internal)
  // ---------------------------------------------------------------------------

  const [internalYear, setInternalYear] = useState(() => String(currentSeasonYear()))
  const year = controlledYear ?? internalYear
  const setSeasonYear = onControlledYearChange ?? setInternalYear

  /** "All time" (top of the season dropdown, `?season=all-time`) shows the greatest of all time instead of a season. */
  const [allTime, setAllTime] = useState(() => searchParams.get("season") === ALL_TIME_SEASON)
  /** Picks a season year or All time, and syncs `?season=` for All time. */
  const setYear = (val: string) => {
    const nextAllTime = val === ALL_TIME_SEASON
    setAllTime(nextAllTime)
    if (!nextAllTime) setSeasonYear(val)
    const params = new URLSearchParams(searchParams.toString())
    if (nextAllTime) params.set("season", ALL_TIME_SEASON)
    else params.delete("season")
    if (nextAllTime !== allTime) router.replace(`?${params.toString()}`, { scroll: false })
  }

  const [internalDivision, setInternalDivision] = useState<Division>(initialDivision)
  const division = controlledDivision ?? internalDivision
  const setDivisionRaw = onControlledDivisionChange ?? setInternalDivision

  const [internalView, setInternalView] = useState<LeaderboardView>(initialView)
  const view = controlledView ?? internalView
  const setViewRaw = onControlledViewChange ?? setInternalView
  /** Whether the Schools roll-up for the active division is shown instead of individual teams. */
  const isSchools = view === "schools"

  // ---------------------------------------------------------------------------
  // Sort state
  // ---------------------------------------------------------------------------

  const [sort, setSort] = useState<SortState>({ key: "rank", dir: "asc" })

  /** Free-text school/name filter. */
  const [query, setQuery] = useState("")

  /** Which of the division's datasets is shown (LD: full season vs. Sep–Oct topic). */
  const [datasetIndex, setDatasetIndex] = useState(0)

  /** Schools table sort state. */
  const [schoolSort, setSchoolSort] = useState<SchoolSortState>({ key: "rank", dir: "asc" })

  /** Changes division, resets sort, and writes the new value to the URL. */
  const changeDivision = (val: Division) => {
    setDivisionRaw(val)
    setSort({ key: "rank", dir: "asc" })
    setSchoolSort({ key: "rank", dir: "asc" })
    setDatasetIndex(0)
    const params = new URLSearchParams(searchParams.toString())
    params.set("format", val)
    if (view === "schools") params.set("by", "schools")
    else params.delete("by")
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  /** Toggles between Teams and Schools for the current division and syncs `?by=`. */
  const changeView = (val: LeaderboardView) => {
    setViewRaw(val)
    setSort({ key: "rank", dir: "asc" })
    setSchoolSort({ key: "rank", dir: "asc" })
    const params = new URLSearchParams(searchParams.toString())
    params.set("format", division)
    if (val === "schools") params.set("by", "schools")
    else params.delete("by")
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  /** Rank and text columns start ascending; numeric columns start highest-first. */
  const toggleSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev?.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" }
      const ascFirst = key === "rank" || key === "name" || key === "school" || key === "hash"
      return { key, dir: ascFirst ? "asc" : "desc" }
    })
  }

  /** Same convention as {@link toggleSort}, for the Schools table. */
  const toggleSchoolSort = (key: SchoolSortKey) => {
    setSchoolSort((prev) => {
      if (prev.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" }
      const ascFirst = key === "rank" || key === "school" || key === "bestEntry"
      return { key, dir: ascFirst ? "asc" : "desc" }
    })
  }

  // ---------------------------------------------------------------------------
  // Year list
  // ---------------------------------------------------------------------------

  const years = seasonYears()
  const isCurrentYear = year === years[0]

  // ---------------------------------------------------------------------------
  // Data loading (delegated to hook)
  // ---------------------------------------------------------------------------

  /**
   * The Elo source covers 2015-16 to now. A past season shows only the
   * datasets it has (not LD's Sep–Oct slice, which only the current CSVs have).
   */
  const seasonYear = Number(year)
  const primaryDatasetId = divisionDatasets(division)[0]
  const datasetIds = isSchools
    ? []
    : divisionDatasets(division).filter((id) => isCurrentYear || hasExtinctionSeason(id, seasonYear))
  const datasetId = datasetIds[Math.min(datasetIndex, datasetIds.length - 1)] ?? null
  /** Whether the selected season has rankings; before 2015-16 only the banner (and NDT's scraped table) shows. */
  const hasRankings = isCurrentYear || datasetIds.length > 0
  const hasSchoolRankings = isCurrentYear || (primaryDatasetId ? hasExtinctionSeason(primaryDatasetId, seasonYear) : false)
  const { dataset, loading, error, debateHistory, championsLoading } =
    useLeaderboardData(hasRankings && !allTime ? datasetId : null, history, isCurrentYear ? undefined : seasonYear)
  const schoolData = useSchoolRankingsSnapshot(isSchools && hasSchoolRankings && !allTime, isCurrentYear ? undefined : seasonYear)
  /** Last season's lists, for the +/− (places moved) column; absent before the first ranked season. */
  const previousSeasonYear = seasonYear - 1
  const previousDataset = usePreviousSeasonDataset(
    hasRankings && datasetId && hasExtinctionSeason(datasetId, previousSeasonYear) ? datasetId : null,
    previousSeasonYear,
  )
  const previousSchoolData = useSchoolRankingsSnapshot(
    isSchools && hasSchoolRankings && Boolean(primaryDatasetId && hasExtinctionSeason(primaryDatasetId, previousSeasonYear)),
    previousSeasonYear,
  )
  /**
   * The Elo source lists TOC bids for every high school division and season.
   * If it was unreachable this season, high school policy falls back to the
   * community bids sheet.
   */
  const extinctionBids = !isSchools && division !== "NDT" && dataset?.source === "extinction"
  const sheetBids = !isSchools && isCurrentYear && division === "VCX" && !!dataset && dataset.source !== "extinction"
  const tocBids = useTocBids(sheetBids)

  // ---------------------------------------------------------------------------
  // Derived display values
  // ---------------------------------------------------------------------------

  const isControlled = controlledDivision !== undefined
  const showInternalFilters = !isControlled

  /** Bids per entry; `undefined` hides the column. */
  const entryBids = useMemo(
    () =>
      extinctionBids && dataset
        ? extinctionEntryBids(dataset)
        : sheetBids && tocBids && dataset
          ? matchTocBids(dataset.entries, tocBids)
          : undefined,
    [extinctionBids, sheetBids, tocBids, dataset],
  )
  /**
   * The current season compares with the positions saved every 90 days
   * (`rankBaseline.ts`); past seasons, and a list with no save a day old yet,
   * compare with last season's list.
   */
  const teamBaseline = useRankBaseline(isCurrentYear && !isSchools && datasetId ? `team:${datasetId}` : null)
  const schoolBaseline = useRankBaseline(isCurrentYear && isSchools ? `school:${division}` : null)
  /** Places each team moved since the baseline (or last season); `undefined` hides the column. */
  const entryRankChanges = useMemo(
    () =>
      dataset && teamBaseline
        ? buildTeamRankChanges(
            dataset.entries,
            teamBaseline.rows.map((row) => ({ rank: row.rank, school: row.school, name: row.name ?? "" })),
          )
        : dataset && previousDataset
          ? buildTeamRankChanges(dataset.entries, previousDataset.entries)
          : undefined,
    [dataset, teamBaseline, previousDataset],
  )
  const visibleEntries = sortEntries(
    filterEntries(dataset?.entries ?? [], query),
    sort,
    (e) => entryBids?.get(rankedTeamKey(e))?.bids ?? 0,
    (e) => entryRankChanges?.get(teamRankChangeKey(e)) ?? null,
  )
  const schoolRows = useMemo(
    () => (isSchools ? (schoolData.snapshot?.scopes[division] ?? []) : []),
    [isSchools, schoolData.snapshot, division],
  )
  /** Places each school moved since last season in the same division; `undefined` hides the column. */
  const schoolRankChanges = useMemo(() => {
    const previousRows = !isSchools
      ? undefined
      : schoolBaseline
        ? schoolBaseline.rows.map((row) => ({ rank: row.rank, school: row.school }))
        : previousSchoolData.snapshot?.scopes[division]
    return previousRows && schoolRows.length > 0
      ? buildRankChanges<{ rank: number; school: string }>(schoolRows, previousRows, schoolRankChangeKey)
      : undefined
  }, [isSchools, schoolBaseline, previousSchoolData.snapshot, division, schoolRows])
  /** The change column's tooltip names the saved baseline when one is in use. */
  const rankChangeTooltip = isSchools
    ? schoolBaseline
      ? rankBaselineTooltip(schoolBaseline.capturedAt, false)
      : undefined
    : teamBaseline
      ? rankBaselineTooltip(teamBaseline.capturedAt, true)
      : undefined
  /** The division table's School column shows each school's Schools-tab rank for this division. */
  const divisionSchoolRanks = useMemo(
    () =>
      schoolRanksByName(isSchools || !dataset ? [] : schoolRankingsFor({ [division]: dataset }, division)),
    [isSchools, dataset, division],
  )
  const visibleSchools = sortSchools(
    filterSchools(schoolRows, query),
    schoolSort,
    (r) => schoolRankChanges?.get(schoolRankChangeKey(r)) ?? null,
  )
  // Legendary cutoffs come from the whole list, so searching never changes them.
  const entryLegendary = legendaryCount((dataset?.entries ?? []).map((e) => e.adjustedRating))
  const schoolLegendary = legendaryCount(schoolRows.map((r) => r.balancedScore))

  const divConfig = DIVISION_CONFIG.find((d) => d.value === division)!
  const yearData = debateHistory?.[year]
  const topic = resolveDivisionTopic(yearData, division)
  const topicName =
    divConfig.topicNameKey && typeof yearData?.[divConfig.topicNameKey] === "string"
      ? (yearData[divConfig.topicNameKey] as string)
      : undefined
  const champion =
    typeof yearData?.[divConfig.championKey] === "string"
      ? (yearData[divConfig.championKey] as string)
      : undefined

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filter controls — hidden when the parent supplies division/year */}
        {showInternalFilters && (
          <LeaderboardFilterBar
            division={division}
            view={view}
            year={allTime ? ALL_TIME_SEASON : year}
            years={years}
            onChangeDivision={changeDivision}
            onChangeView={changeView}
            onChangeYear={setYear}
          />
        )}

        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-[1600px] mx-auto">
            {allTime && showInternalFilters ? (
              <AllTimeRankingsView division={division} view={view} />
            ) : (
            <>
            {/* Champion / topic banner */}
            {!championsLoading && !isSchools && (
              <LeaderboardChampionBanner
                division={division}
                year={year}
                topic={topic}
                topicName={topicName}
                champion={champion}
              />
            )}

            {datasetIds.length > 1 && isCurrentYear && (
              <Tabs
                value={String(datasetIndex)}
                onValueChange={(v) => setDatasetIndex(Number(v))}
                className="mb-3"
              >
                <TabsList className="h-8">
                  {datasetIds.map((id, i) => (
                    <TabsTrigger key={id} value={String(i)} className="px-3 text-xs">
                      {getRankingDatasetInfo(id)?.scope ?? "Full season"}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}

            {isSchools && hasSchoolRankings ? (
              <>
                {division === "NDT" ? (
                  <NdtEliteSchoolsSection className="mb-4" />
                ) : (
                  <HsEliteSchoolsSection event={HS_ELITE_EVENTS[division]} className="mb-4" />
                )}
                {schoolData.loading ? (
                  <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4" />
                      <p className="text-muted-foreground">Loading school rankings...</p>
                    </div>
                  </div>
                ) : schoolData.error ? (
                  <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                    <div className="text-6xl mb-4">⚠️</div>
                    <h2 className="text-2xl font-semibold text-foreground mb-2">
                      Error Loading Rankings
                    </h2>
                    <p className="text-muted-foreground max-w-md">{schoolData.error}</p>
                  </div>
                ) : (
                  <>
                    <p className="mb-3 text-sm text-muted-foreground">
                      {schoolRows.length} schools, ranked by a balanced score that weighs the
                      average of each school's top three teams at 70%, with the rest from its
                      average rating and number of teams.
                    </p>
                    <div className="relative mb-3 max-w-sm">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Filter by school or team"
                        aria-label="Filter school rankings by school or team"
                        className="h-9 pl-8"
                      />
                    </div>
                    {visibleSchools.length > 0 ? (
                      <SchoolRankingsTable rows={visibleSchools} legendary={schoolLegendary} format={DIVISION_SHORT_LABELS[division]} sort={schoolSort} onToggleSort={toggleSchoolSort} ndt={schoolData.snapshot?.ndt} rankChanges={schoolRankChanges} rankChangeTooltip={rankChangeTooltip} showNdt={division === "NDT"} />
                    ) : (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        {query ? `No schools match "${query}".` : "No school rankings are published yet."}
                      </p>
                    )}
                    {division === "NDT" && <NdtAllSeasonsSection className="mt-6" />}
                  </>
                )}
              </>
            ) : !hasRankings && division === "NDT" && hasCollegeHistory(year) ? (
              <>
                <div className="relative mb-3 max-w-sm">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter by team or school"
                    aria-label="Filter past-season rankings by team or school"
                    className="h-9 pl-8"
                  />
                </div>
                <CollegeHistoryTable year={year} query={query} />
              </>
            ) : !hasRankings || (isSchools && !hasSchoolRankings) ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground text-center">
                Rankings start with the 2015-16 season. Historical champion and
                topic data is shown above when available for the selected
                season.
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4" />
                  <p className="text-muted-foreground">Loading rankings...</p>
                </div>
              </div>
            ) : error || !dataset ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <div className="text-6xl mb-4">⚠️</div>
                <h2 className="text-2xl font-semibold text-foreground mb-2">
                  Error Loading Rankings
                </h2>
                <p className="text-muted-foreground max-w-md">
                  {error ?? `No rankings are published for ${divConfig.label}.`}
                </p>
              </div>
            ) : (
              <>
                <RankingsFieldSummary dataset={dataset} />
                {dataset.source === "extinction" && (
                  <p className="mb-3 text-xs text-muted-foreground">
                    Elo ratings{division !== "NDT" ? " and TOC bids" : ""} compiled from Tabroom round results and openCaselist
                    {isCurrentYear && dataset.field ? "; aff/neg win rates from this season's ballots" : ""}.
                  </p>
                )}
                <div className="relative mb-3 max-w-sm">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter by name or school"
                    aria-label="Filter rankings by name or school"
                    className="h-9 pl-8"
                  />
                </div>
                {visibleEntries.length > 0 ? (
                  <RankingsTable entries={visibleEntries} legendary={entryLegendary} schoolRanks={divisionSchoolRanks} division={division} sort={sort} onToggleSort={toggleSort} bids={entryBids} rankChanges={entryRankChanges} rankChangeTooltip={rankChangeTooltip} />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No entries match "{query}".
                  </p>
                )}
              </>
            )}
            </>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

/**
 * The Bids column's data for an Elo-source dataset: each entry's TOC bid
 * tournaments (by name where the season's list has it), keyed by `rankedTeamKey`.
 */
function extinctionEntryBids(dataset: RankingDataset): Map<string, TocBidTeam> {
  const names = new Map((dataset.bidTournaments ?? []).map((t) => [t.code, t.name]))
  const bids = new Map<string, TocBidTeam>()
  for (const entry of dataset.entries) {
    const codes = entry.tocBids ?? []
    if (codes.length === 0) continue
    bids.set(rankedTeamKey(entry), {
      bids: codes.length,
      team: `${entry.school}${entry.teamCode ? ` ${entry.teamCode}` : ""}`,
      school: entry.school,
      code: entry.teamCode ?? "",
      debaters: entry.name,
      state: "",
      tournaments: codes.map((code) => names.get(code) ?? code),
    })
  }
  return bids
}
