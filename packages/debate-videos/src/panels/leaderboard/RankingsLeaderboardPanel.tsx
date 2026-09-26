/**
 * @fileoverview Ranking and leaderboard panel for debate teams.
 * Shows the Glicko-2 rankings computed by the `debate-rankings` package for
 * VPF, VLD, VCX and NDT (college policy), with historical champion data,
 * plus a Schools tab that rolls every division's entries up by school.
 *
 * Delegates data loading to {@link useLeaderboardData}, the grid to
 * {@link RankingsTable} and filter UI to {@link LeaderboardFilterBar},
 * keeping this file focused on orchestration.
 * @module components/debate/DebateVideos/panels/RankingsLeaderboardPanel
 */

"use client"

import { useState, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { getRankingDatasetInfo } from "debate-rankings-adapter"
import { TooltipProvider } from "../../ui/primitives/tooltip"
import { Tabs, TabsList, TabsTrigger } from "../../ui/primitives/tabs"
import { Input } from "../../ui/primitives/input"
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
import { useLeaderboardData } from "../../hooks/useLeaderboardData"
import { useSchoolRankingsData } from "../../hooks/useSchoolRankingsData"
import { SchoolRankingsTable } from "./SchoolRankingsTable"
import { LeaderboardChampionBanner } from "./LeaderboardChampionBanner"
import { RankingsTable } from "./RankingsTable"
import { RankingsFieldSummary } from "./RankingsFieldSummary"
import { LeaderboardFilterBar } from "./LeaderboardFilterBar"


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

  const datasetIds = isSchools ? [] : divisionDatasets(division)
  const datasetId = datasetIds[Math.min(datasetIndex, datasetIds.length - 1)] ?? null
  /** `debate-rankings` covers the current season only; older years show the banner alone. */
  const { dataset, loading, error, debateHistory, championsLoading } =
    useLeaderboardData(isCurrentYear ? datasetId : null, history)
  const schoolData = useSchoolRankingsData(isSchools && isCurrentYear)

  // ---------------------------------------------------------------------------
  // Derived display values
  // ---------------------------------------------------------------------------

  const isControlled = controlledDivision !== undefined
  const showInternalFilters = !isControlled

  const visibleEntries = sortEntries(filterEntries(dataset?.entries ?? [], query), sort)
  const schoolRows = useMemo(
    () => (isSchools ? schoolRankingsFor(schoolData.datasets, schoolScope) : []),
    [isSchools, schoolData.datasets, schoolScope],
  )
  const visibleSchools = sortSchools(filterSchools(schoolRows, query), schoolSort)

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

            {isSchools && isCurrentYear ? (
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
                      {schoolRows.length} schools, ranked by their best entry's rating, with the
                      average rating of every ranked team from the school.
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
                      <SchoolRankingsTable rows={visibleSchools} sort={schoolSort} onToggleSort={toggleSchoolSort} />
                    ) : (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        {query ? `No schools match "${query}".` : "No school rankings are published yet."}
                      </p>
                    )}
                  </>
                )}
              </>
            ) : !isCurrentYear ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground text-center">
                Rankings are computed for the current season only. Historical
                champion and topic data is shown above when available for the
                selected season.
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
                  <RankingsTable entries={visibleEntries} division={division} sort={sort} onToggleSort={toggleSort} />
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
