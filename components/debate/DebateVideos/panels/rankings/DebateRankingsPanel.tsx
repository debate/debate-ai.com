/**
 * @fileoverview Debate rankings panel for debate teams.
 * Supports VPF, VLD, VCX, and NDT divisions with historical season data.
 *
 * Delegates data-fetching to {@link useLeaderboardData} and filter UI to
 * {@link LeaderboardFilterBar}, keeping this file focused on orchestration.
 * @module components/debate/DebateVideos/panels/rankings/DebateRankingsPanel
 */

"use client"

import { useState, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  DIVISION_CONFIG,
  VALID_DIVISIONS,
  sortEntries,
  type Division,
  type SortKey,
  type SortState,
  type LeaderboardPanelProps,
} from "./leaderboardUtils"
import { useLeaderboardData } from "../../hooks/useLeaderboardData"
import { LeaderboardChampionBanner } from "./LeaderboardChampionBanner"
import { LeaderboardTable } from "./LeaderboardTable"
import { LeaderboardFilterBar } from "./LeaderboardFilterBar"

/**
 * Full-page debate rankings panel.
 *
 * When no controlled props are provided the panel manages division/year state
 * internally and syncs the active division to the `?format=` URL query param.
 * When `controlledDivision` and `controlledYear` are provided the parent owns
 * those values and the internal filter UI is hidden.
 *
 * @param props - See {@link LeaderboardPanelProps}.
 */
export function DebateRankingsPanel({
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
    return f && VALID_DIVISIONS.has(f) ? (f as Division) : "VPF"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // Division / year state (controlled or internal)
  // ---------------------------------------------------------------------------

  const [internalYear, setInternalYear] = useState("2026")
  const year = controlledYear ?? internalYear
  const setYear = onControlledYearChange ?? setInternalYear

  const [internalDivision, setInternalDivision] = useState<Division>(initialDivision)
  const division = controlledDivision ?? internalDivision
  const setDivisionRaw = onControlledDivisionChange ?? setInternalDivision

  // ---------------------------------------------------------------------------
  // Sort state
  // ---------------------------------------------------------------------------

  const [sort, setSort] = useState<SortState>({ key: "eloRank", dir: "asc" })

  /** Changes division, resets sort, and writes the new value to the URL. */
  const changeDivision = (val: Division) => {
    setDivisionRaw(val)
    setSort(null)
    const params = new URLSearchParams(searchParams.toString())
    params.set("format", val)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  const toggleSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev?.key === key) {
        return prev.dir === "desc" ? { key, dir: "asc" } : null
      }
      return { key, dir: "desc" }
    })
  }

  // ---------------------------------------------------------------------------
  // Year list
  // ---------------------------------------------------------------------------

  const currentYear = new Date().getFullYear()
  const maxYear = Math.max(currentYear, 2026)
  const years = Array.from({ length: maxYear - 2001 }, (_, i) => String(maxYear - i))
  const isCurrentYear = year === String(maxYear)

  // ---------------------------------------------------------------------------
  // Data fetching (delegated to hook)
  // ---------------------------------------------------------------------------

  const { data, loading, error, debateHistory, championsLoading } =
    useLeaderboardData(division, year, history)

  // ---------------------------------------------------------------------------
  // Derived display values
  // ---------------------------------------------------------------------------

  const isControlled = controlledDivision !== undefined
  const showInternalFilters = !isControlled

  /** Show Elo columns only for formats where Elo data is computed. */
  const showElo = division === "VPF" || division === "VLD"
  /** Prior seasons only have Elo data; bids/score/state columns are current-year only. */
  const showTocColumns = isCurrentYear

  const gridCols = !showTocColumns
    ? "grid-cols-[40px_1fr_70px] sm:grid-cols-[50px_1fr_80px]"
    : showElo
      ? "grid-cols-[50px_50px_1fr_32px_40px_50px_70px_60px_60px] sm:grid-cols-[70px_60px_1fr_40px_50px_70px_70px_70px_70px]"
      : "grid-cols-[40px_1fr_32px_40px_50px] sm:grid-cols-[50px_1fr_40px_50px_70px]"

  const filteredData = sortEntries(data, sort)

  const divConfig = DIVISION_CONFIG.find((d) => d.value === division)!
  const yearData = debateHistory?.[year]
  const topic = yearData?.[divConfig.topicKey]
  const champion = yearData?.[divConfig.championKey]

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
            year={year}
            years={years}
            onChangeDivision={changeDivision}
            onChangeYear={setYear}
          />
        )}

        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-[1600px] mx-auto">
            {/* Champion / topic banner */}
            {!championsLoading && (
              <LeaderboardChampionBanner
                division={division}
                year={year}
                topic={topic}
                champion={champion}
              />
            )}

            {/* NDT: champions-only view (no leaderboard rows) */}
            {division === "NDT" ? (
              championsLoading ? (
                <div className="flex items-center justify-center min-h-[400px]">
                  <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4" />
                    <p className="text-muted-foreground">Loading data...</p>
                  </div>
                </div>
              ) : null
            ) : (
              <>
                {loading ? (
                  <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                      <div className="text-4xl mb-2">⏳</div>
                      <p className="text-muted-foreground">Loading rankings...</p>
                    </div>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                    <div className="text-6xl mb-4">⚠️</div>
                    <h2 className="text-2xl font-semibold text-foreground mb-2">
                      Error Loading Data
                    </h2>
                    <p className="text-muted-foreground max-w-md">{error}</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                    >
                      Retry
                    </button>
                  </div>
                ) : filteredData.length > 0 ? (
                  /* key=division resets the table's internal expandedRow state on division change */
                  <LeaderboardTable
                    key={division}
                    filteredData={filteredData}
                    showElo={showElo}
                    showTocColumns={showTocColumns}
                    gridCols={gridCols}
                    division={division}
                    sort={sort}
                    onToggleSort={toggleSort}
                  />
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
