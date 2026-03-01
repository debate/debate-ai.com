"use client"

/**
 * @fileoverview Custom hook for managing timer state at the page level.
 *
 * Lifts timer state out of TimersPanel so it persists when the mobile
 * sidebar (Sheet) unmounts. Also exposes an `activeTimer` summary for
 * rendering a compact timer in the mobile header bar.
 *
 * @module components/debate/flow/hooks/useTimerState
 */

import { useState, useEffect } from "react"
import { settings } from "@/lib/state/settings"
import { debateStyles, debateStyleMap } from "@/lib/debate-data/debate-styles"

/** Describes the currently running timer (if any) for the header display. */
export type ActiveTimerInfo = {
  label: string
  totalTime: number
  startTime: number
} | null

/**
 * Hook that owns all debate timer state (speech + prep timers).
 *
 * Call this at the DebateFlowPage level and pass the returned values
 * down to TimersPanel (via FlowPageSidebar) and FlowPageHeader.
 */
export function useTimerState() {
  const [debateStyleIndex, setDebateStyleIndex] = useState(
    settings.data.debateStyle.value as number,
  )
  const [debateStyle, setDebateStyle] = useState<DebateStyle>(
    debateStyles[debateStyleMap[debateStyleIndex]],
  )

  // Speech timer state
  const [speechState, setSpeechState] = useState<SpeechTimerState>({
    resetTimeIndex: 0,
    time: debateStyle.timerSpeeches[0].time,
    state: { name: "paused" },
  })

  // Prep timer states (one per team)
  const [prepState, setPrepState] = useState<TimerState | null>(
    debateStyle.prepTime
      ? {
          resetTime: debateStyle.prepTime,
          time: debateStyle.prepTime,
          state: { name: "paused" },
        }
      : null,
  )

  const [prepSecondaryState, setPrepSecondaryState] =
    useState<TimerState | null>(
      debateStyle.prepTime
        ? {
            resetTime: debateStyle.prepTime,
            time: debateStyle.prepTime,
            state: { name: "paused" },
          }
        : null,
    )

  // Subscribe to debate style changes and reset all timers
  useEffect(() => {
    const unsubscribe = settings.subscribe(
      ["debateStyle"],
      (key: string) => {
        const newIndex = settings.data[key].value as number
        if (newIndex !== debateStyleIndex) {
          setDebateStyleIndex(newIndex)
          const newStyle = debateStyles[debateStyleMap[newIndex]]
          setDebateStyle(newStyle)

          setSpeechState({
            resetTimeIndex: 0,
            time: newStyle.timerSpeeches[0].time,
            state: { name: "paused" },
          })

          if (newStyle.prepTime) {
            setPrepState({
              resetTime: newStyle.prepTime,
              time: newStyle.prepTime,
              state: { name: "paused" },
            })
            setPrepSecondaryState({
              resetTime: newStyle.prepTime,
              time: newStyle.prepTime,
              state: { name: "paused" },
            })
          } else {
            setPrepState(null)
            setPrepSecondaryState(null)
          }
        }
      },
    )

    return unsubscribe
  }, [debateStyleIndex])

  // Compute which timer is currently running (for header display)
  let activeTimer: ActiveTimerInfo = null
  if (speechState.state.name === "running") {
    const speech = debateStyle.timerSpeeches[speechState.resetTimeIndex]
    activeTimer = {
      label: speech.name,
      totalTime: speech.time,
      startTime: speechState.state.startTime,
    }
  } else if (prepState?.state.name === "running") {
    activeTimer = {
      label: "Prep",
      totalTime: prepState.resetTime,
      startTime: prepState.state.startTime,
    }
  } else if (prepSecondaryState?.state.name === "running") {
    activeTimer = {
      label: "Prep",
      totalTime: prepSecondaryState.resetTime,
      startTime: prepSecondaryState.state.startTime,
    }
  }

  return {
    debateStyle,
    speechState,
    setSpeechState,
    prepState,
    setPrepState,
    prepSecondaryState,
    setPrepSecondaryState,
    activeTimer,
  }
}
