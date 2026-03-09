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
import type { TimerSpeech, SpeechTimerState } from "@/components/debate/DebateTimer/types"
import type { Round } from "@/components/debate/DebateRound/types"

import { useEffect, useRef, useState } from "react"
import { Play, Pause, RotateCcw } from "lucide-react"
import { playSoundEffect } from "@/components/debate/DebateTimer/timer-sounds/sound-effects"
import { Button } from "@/components/ui/button"
import { MicSelector } from "@/components/debate/DebateTimer/SpeechRecorder/mic-selector"
import { cn } from "@/lib/utils"
import { useSpeechRecorder } from "@/components/debate/DebateRound/hooks/useSpeechRecorder"

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
  /** Full display label for the current speech (name + debater), used when saving recordings */
  speechLabel?: string
  /** Controlled mic device ID — when provided, overrides internal mic state */
  micDeviceId?: string
  /** Callback when mic device changes (used with controlled micDeviceId) */
  onMicDeviceIdChange?: (id: string | undefined) => void
  /** Controlled recording-enabled state — when provided, overrides internal state */
  recordingEnabled?: boolean
  /** Callback when recording-enabled changes (used with controlled recordingEnabled) */
  onRecordingEnabledChange?: (enabled: boolean) => void
  /** When true, hides the built-in MicSelector inside the timer ring */
  hideMicSelector?: boolean
  /** When true, uses a tighter layout with smaller text for use in headers */
  compact?: boolean
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
  onTimeChange,
  onStateChange,
  onFinish,
  children,
  speechLabel,
  micDeviceId: controlledMicDeviceId,
  onMicDeviceIdChange,
  recordingEnabled: controlledRecordingEnabled,
  onRecordingEnabledChange,
  hideMicSelector = false,
  compact = false,
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

  // Audio recording
  const { isRecordingEnabled, setIsRecordingEnabled, selectedMicDeviceId, setSelectedMicDeviceId } = useSpeechRecorder({
    timerState: state,
    currentSpeechName: currentSpeech.name,
    speechLabel,
    micDeviceId: controlledMicDeviceId,
    onMicDeviceIdChange,
    recordingEnabled: controlledRecordingEnabled,
    onRecordingEnabledChange,
  })

  // Sound effects imported via playSoundEffect

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
        const newTime = Math.max(0, currentSpeech.time * 60 * 1000 - elapsed)

        onTimeChange(newTime)

        if (newTime <= 0) {
          playSoundEffect("finalBwong")
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
      onStateChange({ name: "running", startTime: Date.now() - (currentSpeech.time * 60 * 1000 - time) })
    } else if (state.name === "running") {
      onStateChange({ name: "paused" })
    } else if (state.name === "done") {
      onTimeChange(currentSpeech.time * 60 * 1000)
      onStateChange({ name: "paused" })
    }
  }

  /**
   * Reset timer to current speech's default time
   */
  const reset = () => {
    onTimeChange(currentSpeech.time * 60 * 1000)
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
    } else if (e.key === "Enter") {
      e.preventDefault()
      e.currentTarget.blur()
      playSoundEffect("popDown")
      playSoundEffect("popUpOn")
      const mVal = Number.parseInt(minutes) || 0
      const sVal = Number.parseInt(seconds) || 0
      const newTime = mVal * 60000 + sVal * 1000
      onStateChange({ name: "running", startTime: Date.now() - (currentSpeech.time * 60 * 1000 - newTime) })
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
    } else if (e.key === "Enter") {
      e.preventDefault()
      e.currentTarget.blur()
      playSoundEffect("popDown")
      playSoundEffect("popUpOn")
      const mVal = Number.parseInt(minutes) || 0
      const sVal = Number.parseInt(seconds) || 0
      const newTime = mVal * 60000 + sVal * 1000
      onStateChange({ name: "running", startTime: Date.now() - (currentSpeech.time * 60 * 1000 - newTime) })
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
      <div className="flex flex-col items-center gap-0.5 group/timer">
        {/* Time display with controls on sides */}
        <div className="flex items-center gap-0.5">
          {/* Reset button (left) */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "rounded-full opacity-0 group-hover/timer:opacity-100 transition-opacity",
              compact ? "h-5 w-5" : "h-6 w-6"
            )}
            onClick={reset}
          >
            <RotateCcw className="h-3 w-3" />
          </Button>

          {/* Time */}
          <div
            className={cn(
              "flex items-center font-bold tabular-nums",
              compact ? "text-2xl" : "text-4xl",
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
            <span className="text-md">:</span>
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
              "rounded-full",
              compact ? "h-7 w-7" : "h-9 w-9",
              state.name === "running" && "bg-red-500 hover:bg-red-600 text-white"
            )}
            onClick={toggleTimer}
            onMouseDown={() => playSoundEffect("popDown")}
            onMouseUp={() => {
              state.name === "running" ? playSoundEffect("popUpOff") : playSoundEffect("popUpOn")
            }}
          >
            {state.name === "running" ? (
              <Pause className={cn(compact ? "h-4 w-4" : "h-5 w-5")} />
            ) : (
              <Play className={cn(compact ? "h-4 w-4" : "h-5 w-5")} />
            )}
          </Button>
        </div>

        <div className="relative flex items-center justify-center w-full">
          {children}
          {!hideMicSelector && (
            <div className="absolute right-[1rem] top-[-0.75rem]">
              <MicSelector
                value={selectedMicDeviceId}
                onValueChange={setSelectedMicDeviceId}
                muted={!isRecordingEnabled}
                onMutedChange={(m) => setIsRecordingEnabled(!m)}
                disabled={false}
                className="flex-shrink-0 scale-90"
              />
            </div>
          )}
        </div>
      </div>
    </div >
  )
}
