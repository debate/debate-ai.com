/**
 * @fileoverview Season year filter dropdown for the video search bar.
 * @module components/debate/DebateVideos/components/video-search/SeasonDropdown
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** Props for the {@link SeasonDropdown} component. */
interface SeasonDropdownProps {
  /** Currently selected season year, or `undefined` for "All Seasons". */
  selectedYear?: string
  /**
   * Callback invoked with the new year string, or an empty string when the
   * user selects "All Seasons".
   */
  onYearChange: (value: string) => void
  /** Ordered list of season year strings, newest first (e.g. `["2026", "2025", ...]`). */
  years: string[]
  /**
   * Video count per season year key.
   * Keys are four-digit year strings plus `"legacy"` for pre-2010 content.
   * When provided, counts are shown in parentheses next to each option.
   */
  yearCounts: Record<string, number>
}

/**
 * Dropdown that lets the user filter the video grid by debate season year.
 * Seasons span June–June, so the label reads `"{year-1}-{year}"` (e.g. "2025-2026").
 * A "Pre-2010" option is included at the bottom for legacy content.
 *
 * @param props - See {@link SeasonDropdownProps}.
 */
export function SeasonDropdown({
  selectedYear,
  onYearChange,
  years,
  yearCounts,
}: SeasonDropdownProps) {
  return (
    <div className="flex-1 sm:flex-none sm:w-[130px] shrink-0 min-w-[110px] max-w-[160px]">
      <Select
        value={selectedYear || "all"}
        onValueChange={(v) => onYearChange(v === "all" ? "" : v)}
      >
        <SelectTrigger className="h-9">
          <SelectValue placeholder="All Seasons" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Seasons</SelectItem>
          {years.map((y) => (
            <SelectItem key={y} value={y}>
              {Number(y) - 1}-{y} {yearCounts[y] ? `(${yearCounts[y]})` : ""}
            </SelectItem>
          ))}
          <SelectItem value="legacy">
            Pre-2010 {yearCounts["legacy"] ? `(${yearCounts["legacy"]})` : ""}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
