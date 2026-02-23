"use client"

/**
 * @fileoverview Leaderboard Panel Component
 *
 * Displays debate team rankings with statistics.
 * Features:
 * - Year and division (VPF/VLD) selection
 * - Multiple ranking metrics (OTR, bids, W-L records, speaker points)
 * - Tooltips explaining each column
 * - Responsive table layout
 *
 * @module components/debate/videos/panels/LeaderboardPanel
 */

import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import type { LeaderboardEntry } from "@/lib/third-party-sync/sync-debate-leaderboard"
import grab from "grab-url"

/**
 * Configuration for a single leaderboard table column.
 * Each column maps a display label and tooltip to an index into the values array.
 */
type ColumnConfig = {
  /** Short label shown in the table header */
  label: string
  /** Tooltip text explaining the metric */
  tooltip: string
  /** Index into the LeaderboardEntry values array for this column */
  index: number
}

/**
 * Column configuration for the leaderboard table.
 * Each entry has a label, tooltip, and index into the values array.
 */
const COLUMNS: ColumnConfig[] = [
  { label: "OTR", tooltip: "Overall Team Rating - aggregate rating across all tournaments", index: 0 },
  { label: "BIDS", tooltip: "Tournament of Champions bids earned", index: 1 },
  { label: "PRELIM W-L", tooltip: "Prelim win-loss record", index: 3 },
  { label: "ELIM W-L", tooltip: "Elimination round win-loss record", index: 6 },
  { label: "STD DEV", tooltip: "Standard deviation of speaker points", index: 4 },
  { label: "AVG SPK", tooltip: "Average speaker points", index: 5 },
]

/**
 * LeaderboardPanel - Debate team rankings display
 *
 * Shows ranked list of debate teams with various performance
 * metrics. Supports filtering by year and division.
 *
 * @returns The leaderboard panel component
 *
 * @example
 * ```tsx
 * <LeaderboardPanel />
 * ```
 */
export function LeaderboardPanel() {
  /** Leaderboard data from API */
  const [data, setData] = useState<any>([])

  /** Whether an API request is in progress */
  const [loading, setLoading] = useState(true)

  /** Error message if the API request fails, or null */
  const [error, setError] = useState<string | null>(null)

  /** Selected year used to filter leaderboard results */
  const [year, setYear] = useState("2026")

  /** Selected division - VPF (Public Forum) or VLD (Lincoln-Douglas) */
  const [division, setDivision] = useState<"VPF" | "VLD">("VPF")

  /**
   * Calculate available years for the dropdown.
   * Spans from 2024 to the current year (or 2026 if in the future).
   */
  const currentYear = new Date().getFullYear()
  const maxYear = Math.max(currentYear, 2026)
  const years = Array.from({ length: maxYear - 2023 }, (_, i) => String(2024 + i))

  /**
   * Fetch leaderboard data whenever year or division changes.
   */
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)

      const response = await grab("leaderboard", {
        response: (result: any) => {
          setData(Array.isArray(result) ? result : [])
          setLoading(false)
        },
        division,
        year,
      })

      if (response.error) {
        setError(response.error)
        setLoading(false)
      }
    }

    fetchData()
  }, [year, division])

  // Data is already filtered by API based on division
  const filteredData = data;

  return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filter controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 p-4 border-b">
          {/* Division tabs */}
          <Tabs
            value={division}
            onValueChange={(val) => setDivision(val as typeof division)}
            className="w-full sm:w-auto"
          >
            <TabsList>
              <TabsTrigger value="VPF">VPF</TabsTrigger>
              <TabsTrigger value="VLD">VLD</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Year selector */}
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-full sm:w-[120px]">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Leaderboard content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-[1600px] mx-auto">
            {loading ? (
              // Loading state
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <div className="text-4xl mb-2">⏳</div>
                  <p className="text-muted-foreground">Loading leaderboard...</p>
                </div>
              </div>
            ) : error ? (
              // Error state
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <div className="text-6xl mb-4">⚠️</div>
                <h2 className="text-2xl font-semibold text-foreground mb-2">Error Loading Data</h2>
                <p className="text-muted-foreground max-w-md">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                  Retry
                </button>
              </div>
            ) : filteredData.length === 0 ? (
              // Empty state
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <div className="text-6xl mb-4">🏆</div>
                <h2 className="text-2xl font-semibold text-foreground mb-2">No Data Available</h2>
                <p className="text-muted-foreground">
                  Leaderboard data for {division} in {year} is not available yet.
                </p>
              </div>
            ) : (
              // Leaderboard table
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[60px_minmax(300px,1fr)_repeat(6,90px)] gap-2 px-4 py-3 bg-gray-50 border-b text-sm font-medium text-muted-foreground">
                  <div className="text-left">Rank</div>
                  <div className="text-left">Team</div>
                  {COLUMNS.map((col) => (
                    <Tooltip key={col.label}>
                      <TooltipTrigger asChild>
                        <div className="text-right cursor-help border-b border-dotted border-gray-500">{col.label}</div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{col.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>

                {/* Table rows */}
                {filteredData.map((entry: LeaderboardEntry, index: number) => (
                  <div
                    key={index}
                    className="grid grid-cols-[60px_minmax(300px,1fr)_repeat(6,90px)] gap-2 items-center px-4 py-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
                  >
                    {/* Rank column */}
                    <div className="text-left font-bold text-lg">
                      #{typeof entry.rank === "number" ? entry.rank : entry.rank}
                    </div>

                    {/* Team name column */}
                    <div className="text-left min-w-0">
                      <div className="font-semibold text-base break-words">
                        {entry.teamSchool && entry.teamSchool !== "Unknown Team" ? entry.teamSchool : "Unknown Team"}
                      </div>
                    </div>

                    {/* Stats columns */}
                    {COLUMNS.map((col, i) => {
                      const val = entry.values[col.index]
                      return (
                        <div key={i} className="text-right text-sm">
                          {val !== null ? val : "--"}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
