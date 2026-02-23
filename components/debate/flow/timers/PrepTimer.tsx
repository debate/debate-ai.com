"use client"

/**
 * @fileoverview Prep Timer Component
 *
 * A simple countdown timer for tracking preparation time.
 * Features:
 * - Editable minutes and seconds with keyboard controls
 * - Visual warning states (yellow at 30s, red at 0)
 * - Team color coding (blue for Aff, red for Neg)
 * - Sound effects for start, stop, and finish
 * - Compact mode for sidebar display
 *
 * @module components/debate/timers/PrepTimer
 */

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Play, Pause, RotateCcw } from "lucide-react"
import useSound from "use-sound"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { playSoundEffect } from "@/lib/audio/sound-effects"

// Sound effect paths
const soundPopDown = "/audio/sound-pop-down.mp3"
const soundPopUpOn = "/audio/sound-pop-up-on.mp3"
const soundPopUpOff = "/audio/sound-pop-up-off.mp3"

/**
 * Props for the PrepTimer component
 */
interface PrepTimerProps {
  /** Default/reset time in milliseconds */
  resetTime: number
  /** Current time remaining in milliseconds */
  time: number
  /** Timer state (paused, running, or done) */
  state: TimerState["state"]
  /** Color palette for styling */
  palette?: "accent" | "accent-secondary"
  /** Optional label text */
  label?: string
  /** Team color (blue for Aff, red for Neg) */
  color?: "blue" | "red"
  /** Whether to use compact layout */
  compact?: boolean
  /** Callback when time changes */
  onTimeChange: (time: number) => void
  /** Callback when state changes */
  onStateChange: (state: TimerState["state"]) => void
}

/**
 * PrepTimer - Preparation time countdown timer
 *
 * A simple timer for tracking each team's prep time during a debate.
 * Supports compact mode for sidebar display and team color coding.
 *
 * @param props - Component props
 * @returns The prep timer component
 *
 * @example
 * ```tsx
 * <PrepTimer
 *   resetTime={300000}
 *   time={timeRemaining}
 *   state={timerState}
 *   color="blue"
 *   compact
 *   onTimeChange={setTime}
 *   onStateChange={setState}
 * />
 * ```
 */
export function PrepTimer({
  resetTime,
  time,
  state,
  palette = "accent",
  label,
  color,
  compact = false,
  onTimeChange,
  onStateChange,
}: PrepTimerProps) {
  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const minutesRef = useRef<HTMLInputElement>(null)
  const secondsRef = useRef<HTMLInputElement>(null)

  // Local state for editable time display
  const [minutes, setMinutes] = useState("0")
  const [seconds, setSeconds] = useState("00")

  // Sound effects
  const [playActive] = useSound(soundPopDown)
  const [playOn] = useSound(soundPopUpOn)
  const [playOff] = useSound(soundPopUpOff)

  /**
   * Sync display with time prop
   */
  useEffect(() => {
    const m = Math.floor(time / 60000)
    const s = Math.floor((time % 60000) / 1000)
    setMinutes(m.toString())
    setSeconds(s.toString().padStart(2, "0"))
  }, [time])

  /**
   * Timer countdown logic
   */
  useEffect(() => {
    if (state.name === "running") {
      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - state.startTime
        const newTime = Math.max(0, resetTime - elapsed)

        onTimeChange(newTime)

        if (newTime <= 0) {
          playSoundEffect("finalBeep")
          onStateChange({ name: "done" })
        }
      }, 100)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [state, resetTime, onTimeChange, onStateChange])

  /**
   * Toggle timer between paused/running/done states
   */
  const toggleTimer = () => {
    if (state.name === "paused") {
      onStateChange({ name: "running", startTime: Date.now() - (resetTime - time) })
    } else if (state.name === "running") {
      onStateChange({ name: "paused" })
    } else if (state.name === "done") {
      onTimeChange(resetTime)
      onStateChange({ name: "paused" })
    }
  }

  /**
   * Reset timer to default time
   */
  const reset = () => {
    onTimeChange(resetTime)
    onStateChange({ name: "paused" })
  }

  /**
   * Format seconds value with padding
   */
  const formatTimeValue = (val: string) => {
    let num = Number.parseInt(val)
    if (isNaN(num)) num = 0
    num = Math.min(59, Math.max(0, num))
    return num.toString().padStart(2, "0")
  }

  /**
   * Update time from input fields
   */
  const updateTime = (newMinutes: string, newSeconds: string) => {
    const m = Number.parseInt(newMinutes) || 0
    const s = Number.parseInt(newSeconds) || 0
    const newTime = m * 60000 + s * 1000
    onTimeChange(newTime)
  }

  /**
   * Select all text on focus
   */
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select()
  }

  /**
   * Handle arrow keys in minutes input
   */
  const handleMinutesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const m = Number.parseInt(minutes) || 0
    if (e.key === "ArrowUp") {
      e.preventDefault()
      const newVal = (m + 1).toString()
      setMinutes(newVal)
      updateTime(newVal, seconds)
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      const newVal = Math.max(0, m - 1).toString()
      setMinutes(newVal)
      updateTime(newVal, seconds)
    } else if (e.key === "ArrowRight") {
      e.preventDefault()
      secondsRef.current?.focus()
    }
  }

  /**
   * Handle arrow keys in seconds input
   */
  const handleSecondsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const s = Number.parseInt(seconds) || 0
    if (e.key === "ArrowUp") {
      e.preventDefault()
      const newVal = Math.min(59, s + 1).toString()
      setSeconds(newVal)
      updateTime(minutes, newVal)
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      const newVal = Math.max(0, s - 1).toString()
      setSeconds(newVal)
      updateTime(minutes, newVal)
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      minutesRef.current?.focus()
    }
  }

  /**
   * Format and sync on blur
   */
  const handleBlur = () => {
    const formattedMinutes = (Number.parseInt(minutes) || 0).toString()
    const formattedSeconds = formatTimeValue(seconds)
    setMinutes(formattedMinutes)
    setSeconds(formattedSeconds)
    updateTime(formattedMinutes, formattedSeconds)
  }

  // Visual state flags
  const isWarning = time <= 30000 && time > 0
  const isDone = state.name === "done" || time <= 0

  // Team color classes
  const digitColorClasses =
    color === "blue" ? "text-blue-500 dark:text-blue-400" : color === "red" ? "text-red-500 dark:text-red-400" : ""

  return (
    <div
      className={cn(
        "rounded-[var(--border-radius)] p-[var(--padding)] transition-colors",
        `palette-${palette}`,
        compact && "py-2 px-3",
      )}
    >
      {/* Optional label */}
      {label && <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>}

      <div className="flex items-center gap-2">
        {/* Editable time display */}
        <div
          className={cn(
            compact ? "text-lg" : "text-2xl",
            "font-bold tabular-nums min-w-[80px] flex items-center justify-center",
            isDone && "text-[var(--text-error)] animate-pulse",
            isWarning && "text-yellow-600 dark:text-yellow-400",
            !isDone && !isWarning && digitColorClasses,
          )}
        >
          <input
            ref={minutesRef}
            type="text"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            onFocus={handleFocus}
            onKeyDown={handleMinutesKeyDown}
            onBlur={handleBlur}
            disabled={state.name === "running"}
            className="w-[2ch] bg-transparent border-none text-right outline-none disabled:cursor-not-allowed p-0 m-0"
          />
          <span>:</span>
          <input
            ref={secondsRef}
            type="text"
            value={seconds}
            onChange={(e) => setSeconds(e.target.value)}
            onFocus={handleFocus}
            onKeyDown={handleSecondsKeyDown}
            onBlur={handleBlur}
            disabled={state.name === "running"}
            className="w-[2ch] bg-transparent border-none text-left outline-none disabled:cursor-not-allowed p-0 m-0"
          />
        </div>

        {/* Control buttons */}
        <div className="flex gap-1">
          {/* Play/Pause button */}
          <Button
            variant="ghost"
            size="icon"
            className={compact ? "h-6 w-6" : "h-8 w-8"}
            onClick={toggleTimer}
            onMouseDown={() => playActive()}
            onMouseUp={() => (state.name === "running" ? playOff() : playOn())}
          >
            {state.name === "running" ? (
              <Pause className={compact ? "h-3 w-3" : "h-4 w-4"} />
            ) : (
              <Play className={compact ? "h-3 w-3" : "h-4 w-4"} />
            )}
          </Button>

          {/* Reset button */}
          <Button variant="ghost" size="icon" className={compact ? "h-6 w-6" : "h-8 w-8"} onClick={reset}>
            <RotateCcw className={compact ? "h-3 w-3" : "h-4 w-4"} />
          </Button>
        </div>
      </div>
    </div>
  )
}
