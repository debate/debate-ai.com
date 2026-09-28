/**
 * @fileoverview Division tab switcher and season year selector for the leaderboard panel.
 * Shown only when the parent does not supply controlled division/year values.
 * @module components/debate/DebateVideos/panels/LeaderboardFilterBar
 */

"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/primitives/select"
import { Tabs, TabsList, TabsTrigger } from "../../ui/primitives/tabs"
import { LEADERBOARD_TABS, seasonLabel } from "./leaderboardUtils"
import type { LeaderboardTab } from "./leaderboardTypes"

/** Props for the {@link LeaderboardFilterBar} component. */
interface LeaderboardFilterBarProps {
  /** Currently active division. */
  division: LeaderboardTab
  /** Currently selected season year string (e.g. `"2026"`). */
  year: string
  /** Ordered list of selectable year strings, newest first. */
  years: string[]
  /** Called when the user switches division tabs. */
  onChangeDivision: (val: LeaderboardTab) => void
  /** Called when the user picks a new year. */
  onChangeYear: (val: string) => void
}

/**
 * Renders a responsive row with a division tab strip (plus the Schools tab) and a year `<Select>`.
 *
 * @param props - See {@link LeaderboardFilterBarProps}.
 */
export function LeaderboardFilterBar({
  division,
  year,
  years,
  onChangeDivision,
  onChangeYear,
}: LeaderboardFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Tabs
        value={division}
        onValueChange={(val) => onChangeDivision(val as LeaderboardTab)}
        className="w-auto"
      >
        <TabsList className="h-9">
          {LEADERBOARD_TABS.map((d) => (
            <TabsTrigger key={d.value} value={d.value} className="px-3 text-xs">
              {d.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Select value={year} onValueChange={onChangeYear}>
        <SelectTrigger className="w-[130px] h-9">
          <SelectValue placeholder="Select year" />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={y}>
              {seasonLabel(y)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
