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
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DIVISION_CONFIG } from "./leaderboardUtils"
import type { Division } from "./leaderboardTypes"

/** Props for the {@link LeaderboardFilterBar} component. */
interface LeaderboardFilterBarProps {
  /** Currently active division. */
  division: Division
  /** Currently selected season year string (e.g. `"2026"`). */
  year: string
  /** Ordered list of selectable year strings, newest first. */
  years: string[]
  /** Called when the user switches division tabs. */
  onChangeDivision: (val: Division) => void
  /** Called when the user picks a new year. */
  onChangeYear: (val: string) => void
}

/**
 * Renders a responsive row with a division tab strip and a year `<Select>`.
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
        onValueChange={(val) => onChangeDivision(val as Division)}
        className="w-auto"
      >
        <TabsList className="h-9">
          {DIVISION_CONFIG.map((d) => (
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
              {Number(y) - 1}-{y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
