/**
 * @fileoverview Event tab switcher, Teams/Schools toggle, and season year selector
 * (with "All time" at the top) for the leaderboard panel.
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
import { Trophy } from "lucide-react"
import { ALL_TIME_SEASON } from "./AllTimeRankingsView"

/** Tab value of the Parli tab, after College Policy; it shows the NPDL rankings instead of a division. */
export const PARLI_TAB = "PARLI"

/** Props for the {@link LeaderboardFilterBar} component. */
interface LeaderboardFilterBarProps {
  /** Currently active division. */
  division: Division
  /** Whether individual teams or school roll-ups are shown for the active division. */
  view: LeaderboardView
  /** Currently selected season year string (e.g. `"2026"`), or {@link ALL_TIME_SEASON}. */
  year: string
  /** Ordered list of selectable year strings, newest first. */
  years: string[]
  /** Called when the user switches division tabs. */
  onChangeDivision: (val: Division) => void
  /** Whether the Parli tab is active; it hides the Teams/Schools toggle and the season select (the Parli section has its own). */
  parli?: boolean
  /** Called when the user picks the Parli tab. Omitted hides the tab. */
  onSelectParli?: () => void
  /** Called when the user toggles between Teams and Schools. */
  onChangeView: (val: LeaderboardView) => void
  /** Called when the user picks a new year, or {@link ALL_TIME_SEASON}. */
  onChangeYear: (val: string) => void
}

/**
 * Renders a responsive row with the four event tabs (plus Parli), a Teams/Schools toggle,
 * and a season `<Select>` whose first option, "All time", shows the greatest
 * of all time for the division in place of a season; the Teams/Schools
 * toggle then picks the greatest teams or the greatest schools.
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
  parli = false,
  onSelectParli,
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
        value={parli ? PARLI_TAB : division}
        onValueChange={(val) => (val === PARLI_TAB ? onSelectParli?.() : onChangeDivision(val as Division))}
        className="w-auto"
      >
        <TabsList className="h-9" aria-label="Debate event">
          {LEADERBOARD_TABS.map((d) => (
            <TabsTrigger key={d.value} value={d.value} className="px-3 text-xs">
              {d.label}
            </TabsTrigger>
          ))}
          {onSelectParli && (
            <TabsTrigger value={PARLI_TAB} className="px-3 text-xs">
              Parli
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {!parli && (
      <>
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
          <SelectItem value={ALL_TIME_SEASON}>
            <span className="inline-flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-500" aria-hidden />
              All time
            </span>
          </SelectItem>
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
      </>
      )}
    </div>
  )
}
