"use client"

/**
 * @fileoverview Speech Timer Component
 *
 * A specialized timer for tracking debate speech times.
 * Features:
 * - Speech selection with dropdown navigation
 * - Debater name display from round data
 * - Previous/next speech navigation
 * - Editable minutes and seconds with keyboard controls
 * - Visual warning states (yellow at 30s, red at 0)
 * - Sound effects for start, stop, and finish
 *
 * @module components/debate/timers/SpeechTimer
 */

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react"
import useSound from "use-sound"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { playSoundEffect } from "@/lib/audio/sound-effects"

/**
 * Props for the SpeechTimer component
 */
interface SpeechTimerProps {
  /** Array of speeches with names and times */
  speeches: TimerSpeech[]
  /** Index of current speech in array */
  resetTimeIndex: number
  /** Current time remaining in milliseconds */
  time: number
  /** Timer state (paused, running, or done) */
  state: SpeechTimerState["state"]
  /** Callback when speech selection changes */
  onResetTimeIndexChange: (index: number) => void
  /** Callback when time changes */
  onTimeChange: (time: number) => void
  /** Callback when timer state changes */
  onStateChange: (state: SpeechTimerState["state"]) => void
  /** Optional callback when timer finishes */
  onFinish?: () => void
  /** Optional round data for debater names */
  currentRound?: Round
  /** Optional content to render inside the ring below controls */
  children?: React.ReactNode
}

/**
 * SpeechTimer - Debate speech timing component
 *
 * Displays a countdown timer for debate speeches with speech navigation
 * and optional debater name display when round data is available.
 *
 * @param props - Component props
 * @returns The speech timer component
 *
 * @example
 * ```tsx
 * <SpeechTimer
 *   speeches={debateStyle.timerSpeeches}
 *   resetTimeIndex={0}
 *   time={480000}
 *   state={{ name: "paused" }}
 *   onResetTimeIndexChange={setCurrentSpeech}
 *   onTimeChange={setTime}
 *   onStateChange={setState}
 * />
 * ```
 */
export function SpeechTimer({
  speeches,
  resetTimeIndex,
  time,
  state,
  onResetTimeIndexChange,
  onTimeChange,
  onStateChange,
  onFinish,
  currentRound,
  children,
}: SpeechTimerProps) {
  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const minutesRef = useRef<HTMLInputElement>(null)
  const secondsRef = useRef<HTMLInputElement>(null)

  // Current speech data
  const currentSpeech = speeches[resetTimeIndex]

  // Local state for editable time display
  const [minutes, setMinutes] = useState("0")
  const [seconds, setSeconds] = useState("00")

  // Sound effects
  const [playActive] = useSound("/audio/sound-pop-down.mp3")
  const [playOn] = useSound("/audio/sound-pop-up-on.mp3")
  const [playOff] = useSound("/audio/sound-pop-up-off.mp3")

  /**
   * Extract debater name from email
   */
  const getDebaterName = (email: string) => {
    if (!email) return ""
    return email.split("@")[0]
  }

  /**
   * Build speech menu items with debater names
   */
  const speechMenuItems = speeches.map((speech, index) => {
    let debaterInfo = ""
    if (currentRound) {
      const speechName = speech.name.toLowerCase()
      if (speechName.includes("1a") || speechName.includes("aff")) {
        debaterInfo = getDebaterName(currentRound.debaters.aff[0])
      } else if (speechName.includes("2a")) {
        debaterInfo = getDebaterName(currentRound.debaters.aff[1])
      } else if (speechName.includes("1n") || speechName.includes("neg")) {
        debaterInfo = getDebaterName(currentRound.debaters.neg[0])
      } else if (speechName.includes("2n")) {
        debaterInfo = getDebaterName(currentRound.debaters.neg[1])
      }
    }
    return {
      speech,
      index,
      label: debaterInfo ? `${speech.name} - ${debaterInfo}` : speech.name,
    }
  })

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
        const newTime = Math.max(0, currentSpeech.time - elapsed)

        onTimeChange(newTime)

        if (newTime <= 0) {
          playSoundEffect("finalBeep")
          if (onFinish) {
            onFinish()
          } else {
            onStateChange({ name: "done" })
          }
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
  }, [state, currentSpeech.time, onTimeChange, onStateChange, onFinish])

  /**
   * Toggle timer between paused/running/done states
   */
  const toggleTimer = () => {
    if (state.name === "paused") {
      onStateChange({ name: "running", startTime: Date.now() - (currentSpeech.time - time) })
    } else if (state.name === "running") {
      onStateChange({ name: "paused" })
    } else if (state.name === "done") {
      onTimeChange(currentSpeech.time)
      onStateChange({ name: "paused" })
    }
  }

  /**
   * Reset timer to current speech's default time
   */
  const reset = () => {
    onTimeChange(currentSpeech.time)
    onStateChange({ name: "paused" })
  }

  /**
   * Navigate to next speech
   */
  const nextSpeech = () => {
    if (resetTimeIndex < speeches.length - 1) {
      const newIndex = resetTimeIndex + 1
      onResetTimeIndexChange(newIndex)
      onTimeChange(speeches[newIndex].time)
      onStateChange({ name: "paused" })
    }
  }

  /**
   * Navigate to previous speech
   */
  const prevSpeech = () => {
    if (resetTimeIndex > 0) {
      const newIndex = resetTimeIndex - 1
      onResetTimeIndexChange(newIndex)
      onTimeChange(speeches[newIndex].time)
      onStateChange({ name: "paused" })
    }
  }

  /**
   * Select a specific speech from dropdown
   */
  const selectSpeech = (index: number) => {
    onResetTimeIndexChange(index)
    onTimeChange(speeches[index].time)
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
  const isEarlyWarning = time <= 120000 && time > 30000
  const isWarning = time <= 30000 && time > 0
  const isDone = state.name === "done" || time <= 0
  const palette = currentSpeech.secondary ? "accent-secondary" : "accent"

  return (
    <div
      className={cn(
        "rounded-[var(--border-radius)] transition-colors",
        `palette-${palette}`,
      )}
    >
      {/* Circular progress ring containing all controls */}
      {(() => {
        const size = children ? 200 : 160
        const strokeWidth = 5
        const radius = (size - strokeWidth) / 2
        const circumference = 2 * Math.PI * radius
        const progress = currentSpeech.time > 0 ? time / currentSpeech.time : 0
        const strokeDashoffset = circumference * (1 - progress)

        return (
          <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg
              className="absolute inset-0 -rotate-90"
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
            >
              {/* Background track */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="opacity-10"
              />
              {/* Progress arc */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className={cn(
                  "transition-[stroke-dashoffset] duration-200",
                  isDone && "stroke-[var(--text-error)]",
                  isWarning && !isDone && "stroke-yellow-500",
                  isEarlyWarning && !isWarning && !isDone && "stroke-orange-500",
                  !isDone && !isWarning && !isEarlyWarning && "stroke-blue-500",
                )}
              />
            </svg>

            {/* Content inside ring */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
              {/* Speech Navigation Row */}
              <div className="flex items-center gap-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-3 flex-shrink-0 px-0"
                  onClick={prevSpeech}
                  disabled={resetTimeIndex === 0}
                >
                  <ChevronLeft className="h-2.5 w-2.5" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="justify-between h-5 px-1 min-w-0">
                      <span className="text-[10px] font-medium text-[var(--this-text)] truncate">{currentSpeech.name}</span>
                      <ChevronDown className="h-2.5 w-2.5 ml-0.5 flex-shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-56">
                    {speechMenuItems.map((item) => (
                      <DropdownMenuItem
                        key={item.index}
                        onClick={() => selectSpeech(item.index)}
                        className={cn("cursor-pointer", item.index === resetTimeIndex && "bg-accent")}
                      >
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-3 flex-shrink-0 px-0"
                  onClick={nextSpeech}
                  disabled={resetTimeIndex === speeches.length - 1}
                >
                  <ChevronRight className="h-2.5 w-2.5" />
                </Button>
              </div>

              {/* Time display with controls on sides */}
              <div className="flex items-center gap-0.5">
                {/* Reset button (left) */}
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={reset}>
                  <RotateCcw className="h-3 w-3" />
                </Button>

                {/* Time */}
                <div
                  className={cn(
                    "flex items-center text-4xl font-bold tabular-nums",
                    isDone && "text-[var(--text-error)] animate-pulse",
                    isWarning && !isDone && "text-yellow-600 dark:text-yellow-400",
                    isEarlyWarning && !isWarning && !isDone && "text-orange-500 dark:text-orange-400",
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

                {/* Play/Pause button (right) */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7 rounded-full",
                    state.name === "running"
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "bg-blue-500 hover:bg-blue-600 text-white",
                  )}
                  onClick={toggleTimer}
                  onMouseDown={() => playActive()}
                  onMouseUp={() => {
                    state.name === "running" ? playOff() : playOn()
                  }}
                >
                  {state.name === "running" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </Button>
              </div>

              {children}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
