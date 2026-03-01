/**
 * @fileoverview Mobile header for flow page
 * @module components/debate/flow/layout/FlowPageHeader
 */

"use client"

import { useState, useEffect } from "react"
import { Menu, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ActiveTimerInfo } from "../hooks/useTimerState"

/** Props for the FlowPageHeader component. */
interface FlowPageHeaderProps {
  /** The currently active flow, or null if none is selected. */
  currentFlow: Flow | null
  /** Whether split mode is active; hides the column navigation buttons when true. */
  splitMode: boolean
  /** Handler called when the user taps the hamburger menu button. */
  onMenuClick: () => void
  /** Handler called when the user taps the previous-column chevron. */
  onNavigatePrev: () => void
  /** Handler called when the user taps the next-column chevron. */
  onNavigateNext: () => void
  /** Info about the currently running timer, or null if none is active. */
  activeTimer?: ActiveTimerInfo
}

/**
 * Compact ticking timer shown in the header when a timer is running.
 * Runs its own 100ms interval so it ticks independently of the sidebar.
 */
function HeaderTimerDisplay({ label, totalTime, startTime }: NonNullable<ActiveTimerInfo>) {
  const [display, setDisplay] = useState("")

  useEffect(() => {
    const update = () => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, totalTime - elapsed)
      const m = Math.floor(remaining / 60000)
      const s = Math.floor((remaining % 60000) / 1000)
      setDisplay(`${m}:${s.toString().padStart(2, "0")}`)
    }

    update()
    const id = setInterval(update, 100)
    return () => clearInterval(id)
  }, [totalTime, startTime])

  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 animate-pulse">
      <span className="text-xs font-medium truncate max-w-[4rem]">{label}</span>
      <span className="text-sm font-bold tabular-nums">{display}</span>
    </div>
  )
}

/**
 * Mobile header bar with a menu toggle, flow title, optional timer display,
 * and optional column navigation.
 *
 * @param props - Component props.
 * @param props.currentFlow - Active flow whose `content` is shown as the header title.
 * @param props.splitMode - When true, the column navigation buttons are hidden.
 * @param props.onMenuClick - Callback invoked when the hamburger icon button is clicked.
 * @param props.onNavigatePrev - Callback invoked when the left chevron is clicked.
 * @param props.onNavigateNext - Callback invoked when the right chevron is clicked.
 * @param props.activeTimer - Running timer info for the compact header display.
 * @returns A fixed mobile header row with contextual navigation controls.
 */
export function FlowPageHeader({
  currentFlow,
  splitMode,
  onMenuClick,
  onNavigatePrev,
  onNavigateNext,
  activeTimer,
}: FlowPageHeaderProps) {
  return (
    <div className="bg-[var(--background)] p-2 flex items-center gap-2 border-b border-border">
      <Button variant="ghost" size="icon" onClick={onMenuClick} className="h-8 w-8">
        <Menu className="h-5 w-5" />
      </Button>

      <h1 className="text-lg font-semibold flex-1 truncate">{currentFlow?.content || "Debate Flow"}</h1>

      {activeTimer && <HeaderTimerDisplay {...activeTimer} />}

      {!splitMode && currentFlow && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onNavigatePrev} className="h-8 w-8" aria-label="Previous column">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onNavigateNext} className="h-8 w-8" aria-label="Next column">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
