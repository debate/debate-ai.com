/**
 * @fileoverview Ranking and leaderboard panel for debate teams.
 * Shows the Extinction.GG Elo rankings (with the bundled CSVs' aff/neg win
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
  EXTINCTION_ATTRIBUTION_URL,
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
  VALID_LEADERBOARD_TABS,
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
  type LeaderboardTab,
  type SchoolSortKey,
  type SchoolSortState,
  type SortKey,
  type SortState,
  type LeaderboardPanelProps,
} from "./leaderboardUtils"
import { useLeaderboardData } from "./hooks/useLeaderboardData"
import { useSchoolRankingsSnapshot } from "./hooks/useSchoolRankingsSnapshot"
import { useTocBids } from "./hooks/useTocBids"
import { matchTocBids, rankedTeamKey, type TocBidTeam } from "../sync/sync-toc-bids-sheet"
import { SchoolRankingsTable } from "./SchoolRankingsTable"
import { LeaderboardChampionBanner } from "./LeaderboardChampionBanner"
import { RankingsTable } from "./RankingsTable"
import { legendaryCount } from "./rowTier"
import { RankingsFieldSummary } from "./RankingsFieldSummary"
import { LeaderboardFilterBar } from "./LeaderboardFilterBar"
import { CollegeHistoryTable } from "./CollegeHistoryTable"


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
  controlledYear,
  onControlledDivisionChange,
  onControlledYearChange,
  history,
}: LeaderboardPanelProps = {}) {
  const searchParams = useSearchParams()
  const router = useRouter()

  /** Reads the initial division from the `?format=` param on first render only. */
  const initialDivision = useMemo(() => {
    const f = searchParams.get("format")
    return f && VALID_LEADERBOARD_TABS.has(f) ? (f as LeaderboardTab) : "VPF"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // Division / year state (controlled or internal)
  // ---------------------------------------------------------------------------

  const [internalYear, setInternalYear] = useState(() => String(currentSeasonYear()))
  const year = controlledYear ?? internalYear
  const setYear = onControlledYearChange ?? setInternalYear

  const [internalDivision, setInternalDivision] = useState<LeaderboardTab>(initialDivision)
  const tab = controlledDivision ?? internalDivision
  const setDivisionRaw = onControlledDivisionChange ?? setInternalDivision
  /** The Schools tab is a separate table rolled up from every division. */
  const isSchools = tab === "SCHOOLS"
  /** Division whose rankings are shown; unused while the Schools tab is active. */
  const division: Division = isSchools ? "VPF" : tab

  // ---------------------------------------------------------------------------
  // Sort state
  // ---------------------------------------------------------------------------

  const [sort, setSort] = useState<SortState>({ key: "rank", dir: "asc" })

  /** Free-text school/name filter. */
  const [query, setQuery] = useState("")

  /** Which of the division's datasets is shown (LD: full season vs. Sep–Oct topic). */
  const [datasetIndex, setDatasetIndex] = useState(0)

  /** Schools table: which divisions it rolls up, and its sort. */
  const [schoolScope, setSchoolScope] = useState<"all" | Division>("all")
  const [schoolSort, setSchoolSort] = useState<SchoolSortState>({ key: "rank", dir: "asc" })

  /** Changes division, resets sort, and writes the new value to the URL. */
  const changeDivision = (val: LeaderboardTab) => {
    setDivisionRaw(val)
    setSort({ key: "rank", dir: "asc" })
    setDatasetIndex(0)
    const params = new URLSearchParams(searchParams.toString())
    params.set("format", val)
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
   * Extinction.GG covers 2015-16 to now. A past season shows only the
   * datasets it has (not LD's Sep–Oct slice, which only the current CSVs have).
   */
  const seasonYear = Number(year)
  const datasetIds = isSchools
    ? []
    : divisionDatasets(division).filter((id) => isCurrentYear || hasExtinctionSeason(id, seasonYear))
  const datasetId = datasetIds[Math.min(datasetIndex, datasetIds.length - 1)] ?? null
  /** Whether the selected season has rankings; before 2015-16 only the banner (and NDT's scraped table) shows. */
  const hasRankings = isCurrentYear || datasetIds.length > 0
  const hasSchoolRankings = isCurrentYear || hasExtinctionSeason("hspf", seasonYear)
  const { dataset, loading, error, debateHistory, championsLoading } =
    useLeaderboardData(hasRankings ? datasetId : null, history, isCurrentYear ? undefined : seasonYear)
  const schoolData = useSchoolRankingsSnapshot(isSchools && hasSchoolRankings, isCurrentYear ? undefined : seasonYear)
  /**
   * Extinction.GG lists TOC bids for every high school division and season.
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
  const visibleEntries = sortEntries(
    filterEntries(dataset?.entries ?? [], query),
    sort,
    (e) => entryBids?.get(rankedTeamKey(e))?.bids ?? 0,
  )
  const schoolRows = useMemo(
    () => (isSchools ? (schoolData.snapshot?.scopes[schoolScope] ?? []) : []),
    [isSchools, schoolData.snapshot, schoolScope],
  )
  /** The division table's School column shows each school's Schools-tab rank for this division. */
  const divisionSchoolRanks = useMemo(
    () =>
      schoolRanksByName(isSchools || !dataset ? [] : schoolRankingsFor({ [division]: dataset }, division)),
    [isSchools, dataset, division],
  )
  const visibleSchools = sortSchools(filterSchools(schoolRows, query), schoolSort)
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
            division={tab}
            year={year}
            years={years}
            onChangeDivision={changeDivision}
            onChangeYear={setYear}
          />
        )}

        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-[1600px] mx-auto">
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
                <Tabs
                  value={schoolScope}
                  onValueChange={(v) => setSchoolScope(v as "all" | Division)}
                  className="mb-3"
                >
                  <TabsList className="h-8">
                    <TabsTrigger value="all" className="px-3 text-xs">
                      All events
                    </TabsTrigger>
                    {DIVISION_CONFIG.map((d) => (
                      <TabsTrigger key={d.value} value={d.value} className="px-3 text-xs">
                        {DIVISION_SHORT_LABELS[d.value]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
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
                      <SchoolRankingsTable rows={visibleSchools} legendary={schoolLegendary} format={schoolScope === "all" ? undefined : DIVISION_SHORT_LABELS[schoolScope]} sort={schoolSort} onToggleSort={toggleSchoolSort} ndt={schoolData.snapshot?.ndt} />
                    ) : (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        {query ? `No schools match "${query}".` : "No school rankings are published yet."}
                      </p>
                    )}
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
                    Elo ratings{division !== "NDT" ? " and TOC bids" : ""} from{" "}
                    <a href={EXTINCTION_ATTRIBUTION_URL} target="_blank" rel="noreferrer" className="underline">
                      Extinction.GG
                    </a>
                    , compiled from Tabroom round results and openCaselist
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
                  <RankingsTable entries={visibleEntries} legendary={entryLegendary} schoolRanks={divisionSchoolRanks} division={division} sort={sort} onToggleSort={toggleSort} bids={entryBids} />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No entries match "{query}".
                  </p>
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
 * The Bids column's data for an Extinction.GG dataset: each entry's TOC bid
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
