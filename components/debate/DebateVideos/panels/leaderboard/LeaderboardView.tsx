/**
 * @fileoverview Leaderboard view used by DebateVideosPanel when the active
 * category is "leaderboard". Renders the sticky header with division/year
 * controls and a "Back to Videos" button, then delegates to LeaderboardPanel.
 * @module components/debate/DebateVideos/panels/LeaderboardView
 */

"use client"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Video } from "lucide-react"
import { StickyHeader } from "../components/StickyHeader"
import { LeaderboardPanel } from "./RankingsLeaderboardPanel"

const DIVISION_LABELS: { value: "VPF" | "VLD" | "VCX" | "NDT"; label: string }[] = [
  { value: "VPF", label: "PF" },
  { value: "VLD", label: "LD" },
  { value: "VCX", label: "Policy" },
  { value: "NDT", label: "NDT" },
]

/** Props for the {@link LeaderboardView} component. */
interface LeaderboardViewProps {
  /** Currently active debate division. */
  lbDivision: "VPF" | "VLD" | "VCX" | "NDT"
  /** Setter for the active division. */
  setLbDivision: (v: "VPF" | "VLD" | "VCX" | "NDT") => void
  /** Currently selected season year string (e.g. `"2026"`). */
  lbYear: string
  /** Setter for the active year. */
  setLbYear: (v: string) => void
  /** Ordered list of selectable year strings, newest first. */
  lbYears: string[]
  /** Pre-loaded champion/topic history data passed through to LeaderboardPanel. */
  history: Record<string, any> | undefined
  /** Called when the user clicks the "Back to Videos" button. */
  onBackToVideos: () => void
}

/**
 * Wraps {@link LeaderboardPanel} with a sticky header that provides
 * division tabs, year selector, and a "Back to Videos" button.
 *
 * Receives division/year as controlled props so the parent page can
 * lift that state and restore it if the user navigates back.
 *
 * @param props - See {@link LeaderboardViewProps}.
 */
export function LeaderboardView({
  lbDivision,
  setLbDivision,
  lbYear,
  setLbYear,
  lbYears,
  history,
  onBackToVideos,
}: LeaderboardViewProps) {
  const controls = (
    <>
      <div className="flex items-center gap-1 mr-auto md:mr-0">
        <Button variant="outline" size="sm" className="h-8 gap-1.5 px-3" onClick={onBackToVideos}>
          <Video className="h-4 w-4" />
          <span className="hidden xs:inline">Videos</span>
        </Button>
      </div>
      <Tabs value={lbDivision} onValueChange={(v) => setLbDivision(v as typeof lbDivision)}>
        <TabsList className="h-8">
          {DIVISION_LABELS.map((d) => (
            <TabsTrigger key={d.value} value={d.value} className="text-xs px-2 py-1">
              {d.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Select value={lbYear} onValueChange={setLbYear}>
        <SelectTrigger className="w-[120px] h-8 text-xs">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          {lbYears.map((y) => (
            <SelectItem key={y} value={y} className="text-xs">
              {Number(y) - 1}-{y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <StickyHeader controls={controls} />
      <LeaderboardPanel
        controlledDivision={lbDivision}
        controlledYear={lbYear}
        onControlledDivisionChange={setLbDivision}
        onControlledYearChange={setLbYear}
        history={history}
      />
    </div>
  )
}
