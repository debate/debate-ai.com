/**
 * @fileoverview Event tab switcher, Teams/Schools toggle, and season year selector
 * for the leaderboard panel.
 * Shown only when the parent does not supply controlled division/year values.
 * @module leaderboard/LeaderboardFilterBar
 */

"use client"

import { useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/primitives/select"
import { Tabs, TabsList, TabsTrigger } from "./ui/primitives/tabs"
import { LEADERBOARD_TABS, seasonLabel } from "./leaderboardUtils"
import type { Division, LeaderboardView } from "./leaderboardTypes"
import { AllTimeRankingsButton } from "./AllTimeRankingsButton"
import { Trophy } from "lucide-react"

/** Props for the {@link LeaderboardFilterBar} component. */
interface LeaderboardFilterBarProps {
  /** Currently active division. */
  division: Division
  /** Whether individual teams or school roll-ups are shown for the active division. */
  view: LeaderboardView
  /** Currently selected season year string (e.g. `"2026"`). */
  year: string
  /** Ordered list of selectable year strings, newest first. */
  years: string[]
  /** Called when the user switches division tabs. */
  onChangeDivision: (val: Division) => void
  /** Called when the user toggles between Teams and Schools. */
  onChangeView: (val: LeaderboardView) => void
  /** Called when the user picks a new year. */
  onChangeYear: (val: string) => void
}

/**
 * Renders a responsive row with the four event tabs, a Teams/Schools toggle,
 * a year `<Select>`, and an "All time" button that opens the greatest teams
 * of all time for the division ({@link AllTimeRankingsButton}).
 *
 * @param props - See {@link LeaderboardFilterBarProps}.
 */
export function LeaderboardFilterBar({
  division,
  view,
  year,
  years,
  onChangeDivision,
  onChangeView,
  onChangeYear,
}: LeaderboardFilterBarProps) {
  const [showAllTime, setShowAllTime] = useState(false)

  const handleYearChange = (val: string) => {
    if (val === "all-time") {
      setShowAllTime(true)
    } else {
      onChangeYear(val)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Tabs
        value={division}
        onValueChange={(val) => onChangeDivision(val as Division)}
        className="w-auto"
      >
        <TabsList className="h-9" aria-label="Debate event">
          {LEADERBOARD_TABS.map((d) => (
            <TabsTrigger key={d.value} value={d.value} className="px-3 text-xs">
              {d.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Tabs
        value={view}
        onValueChange={(val) => onChangeView(val as LeaderboardView)}
        className="w-auto"
      >
        <TabsList className="h-9" aria-label="Rankings view">
          <TabsTrigger value="teams" className="px-3 text-xs">
            Teams
          </TabsTrigger>
          <TabsTrigger value="schools" className="px-3 text-xs">
            Schools
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Select value={year} onValueChange={handleYearChange}>
        <SelectTrigger className="w-[130px] h-9">
          <SelectValue placeholder="Select year" />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={y}>
              {seasonLabel(y)}
            </SelectItem>
          ))}
          <SelectItem key="all-time" value="all-time">
            <div className="flex items-center gap-2">
              <Trophy className="text-amber-500" aria-hidden />
              All time
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      <AllTimeRankingsButton division={division} open={showAllTime} onClose={() => setShowAllTime(false)} />
    </div>
  )
}
