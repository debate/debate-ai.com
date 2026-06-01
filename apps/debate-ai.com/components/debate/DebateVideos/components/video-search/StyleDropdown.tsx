/**
 * @fileoverview Debate-format filter dropdown for the video search bar.
 * @module components/debate/DebateVideos/components/video-search/StyleDropdown
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DEBATE_STYLE_LABELS } from "@/lib/types/videos"
import type { DebateStyle } from "@/lib/types/videos"
import { STYLE_COLORS } from "../video-card/videoCardUtils"

/** Props for the {@link StyleDropdown} component. */
interface StyleDropdownProps {
  /** Currently selected debate style, or empty string for "All formats". */
  selectedStyle?: DebateStyle | ""
  /**
   * Callback invoked with the new style value, or an empty string when the
   * user selects "All".
   */
  onStyleChange: (style: DebateStyle | "") => void
  /**
   * Video count per {@link DebateStyle} numeric key.
   * When provided, counts are shown in parentheses next to each option label.
   */
  styleCounts: Record<number, number>
}

/**
 * Dropdown that lets the user filter the video grid by debate format (PF, LD, Policy, College).
 * Each option is colour-coded using {@link STYLE_COLORS} to match the format badges.
 *
 * @param props - See {@link StyleDropdownProps}.
 */
export function StyleDropdown({ selectedStyle, onStyleChange, styleCounts }: StyleDropdownProps) {
  return (
    <div className="w-[80px] shrink-0">
      <Select
        value={selectedStyle ? String(selectedStyle) : "all"}
        onValueChange={(v) =>
          onStyleChange(v === "all" ? "" : (Number(v) as DebateStyle))
        }
      >
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Style" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {(Object.entries(DEBATE_STYLE_LABELS) as [string, string][]).map(
            ([styleStr, label]) => {
              const styleNum = Number(styleStr)
              const count = styleCounts[styleNum]
              return (
                <SelectItem
                  key={styleStr}
                  value={styleStr}
                  className={STYLE_COLORS[styleNum]}
                >
                  {label} {count ? `(${count})` : ""}
                </SelectItem>
              )
            },
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
