/**
 * @fileoverview Header bar for debate speeches, providing timer controls and recording management.
 */

"use client"


import React, { useState, useEffect, useRef, useCallback } from "react"
import type { Round } from "@/components/debate/DebateRound/types"
import { FileText, Share2, Lock, Users, Radio, Quote, ChevronLeft, ChevronRight } from "lucide-react"
import type { ViewMode } from "@/lib/types/debate-flow"
import { ViewModeSelector } from "../controls/ViewModeSelector"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SpeechRecordingPlayer } from "../../DebateTimer/SpeechRecorder/SpeechRecordingPlayer"
import { useFlowStore } from "@/lib/state/store"
import { SpeechTimer } from "../../DebateTimer/SpeechTimer"
import { MicSelector } from "../../DebateTimer/SpeechRecorder/mic-selector"
import { debateStyles, debateStyleMap } from "../../DebateTimer/debate-format-times"
import { settings } from "@/lib/state/settings"
import { cn } from "@/lib/utils"

/** Resolve which debater email corresponds to a given speech column name. */
function getSpeakerEmail(speechName: string, round: Round): string {
  const lower = speechName.toLowerCase()
  if (lower.includes("1a") || lower === "ac") return round.debaters.aff[0] ?? ""
  if (lower.includes("2a")) return round.debaters.aff[1] ?? ""
  if (lower.includes("1n") || lower === "nc") return round.debaters.neg[0] ?? ""
  if (lower.includes("2n")) return round.debaters.neg[1] ?? ""
  return ""
}

/** Read the recording duration (in seconds) for a speech from localStorage. Returns null if none. */
function getRecordingDurationSeconds(speechName: string): number | null {
  try {
    const raw = localStorage.getItem(`debate-recording-${speechName}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { durationSeconds?: number }
    return parsed.durationSeconds ?? null
  } catch {
    return null
  }
}

/** A recording is "near" the speech length if it's at least 60% of the allocated time. */
const NEAR_SPEECH_RATIO = 0.6

export interface SpeechHeaderBarProps {
  /** The speech/column name, e.g. "1AR", "2NC". */
  speechName: string
  /** If provided, renders a speech-doc icon button. */
  onOpenSpeechPanel?: (speechName: string) => void
  /** Active view mode applied to the markdown editor. */
  viewMode?: ViewMode
  /** Whether the quote view overlay is currently active. */
  quoteView?: boolean
  /** Handler called when the user selects a different view mode. */
  onViewModeChange?: (mode: ViewMode) => void
  /** Handler called when the quote view toggle button is clicked. */
  onQuoteViewToggle?: () => void
  /** Controlled timer time in ms. When provided, persists state across navigation. */
  controlledTime?: number
  /** Controlled timer run state. When provided, persists state across navigation. */
  controlledTimerRunState?: { name: "paused" } | { name: "running"; startTime: number } | { name: "done" }
  /** Callback when controlled time changes. */
  onControlledTimeChange?: (time: number) => void
  /** Callback when controlled timer run state changes. */
  onControlledTimerRunStateChange?: (state: { name: "paused" } | { name: "running"; startTime: number } | { name: "done" }) => void
  /** Whether backward speech navigation is available. */
  canNavigatePrev?: boolean
  /** Whether forward speech navigation is available. */
  canNavigateNext?: boolean
  /** Handler called when the user navigates to the previous speech. */
  onNavigatePrev?: () => void
  /** Handler called when the user navigates to the next speech. */
  onNavigateNext?: () => void
}

export function SpeechHeaderBar({
  speechName,
  onOpenSpeechPanel,
  viewMode = "read",
  quoteView = false,
  onViewModeChange,
  onQuoteViewToggle,
  controlledTime,
  controlledTimerRunState,
  onControlledTimeChange,
  onControlledTimerRunStateChange,
  canNavigatePrev,
  canNavigateNext,
  onNavigatePrev,
  onNavigateNext,
}: SpeechHeaderBarProps) {
  const { rounds, flows, selected } = useFlowStore()
  const currentFlow = flows[selected]
  const currentRound = currentFlow?.roundId
    ? rounds.find((r) => r.id === currentFlow.roundId)
    : undefined

  const [micDeviceId, setMicDeviceId] = useState<string | undefined>()
  const [recordingEnabled, setRecordingEnabled] = useState(false)

  // Portal ref for recording seekable progress bar in top edge
  const progressBarPortalRef = useRef<HTMLDivElement>(null)
  const [isRecordingPlaying, setIsRecordingPlaying] = useState(false)
  const handleRecordingPlayingChange = useCallback((playing: boolean) => {
    setIsRecordingPlaying(playing)
  }, [])

  // -- Timer State --
  const currentDebateStyleIndex = (settings.data.debateStyle?.value as number) ?? 0
  const currentStyleKey = debateStyleMap[currentDebateStyleIndex]
  const debateStyle = debateStyles[currentStyleKey]

  const speechIndex = debateStyle?.timerSpeeches.findIndex((s: any) => s.name.toUpperCase() === speechName.toUpperCase()) ?? -1
  const safeSpeechIndex = speechIndex !== -1 ? speechIndex : 0
  const defaultTimeMs = debateStyle?.timerSpeeches[safeSpeechIndex]?.time * 60 * 1000 || 0

  type RunState = { name: "paused" } | { name: "running"; startTime: number } | { name: "done" }

  // Local fallback state (used when no controlled callbacks are provided)
  const [localTime, setLocalTime] = useState(defaultTimeMs)
  const [localTimerState, setLocalTimerState] = useState<RunState>({ name: "paused" })

  // Controlled mode: use callbacks when provided so state persists outside this component
  const isControlled = onControlledTimeChange !== undefined && onControlledTimerRunStateChange !== undefined

  // Effective time and run-state: prefer controlled values (falling back to defaults) when controlled
  const time = isControlled ? (controlledTime ?? defaultTimeMs) : localTime
  const timerState: RunState = isControlled ? (controlledTimerRunState ?? { name: "paused" }) : localTimerState

  const setTime = (t: number) => {
    if (isControlled) {
      onControlledTimeChange!(t)
    } else {
      setLocalTime(t)
    }
  }
  const setTimerState = (s: RunState) => {
    if (isControlled) {
      onControlledTimerRunStateChange!(s)
    } else {
      setLocalTimerState(s)
    }
  }

  // Track recording duration — re-read when a recording is saved
  const [recordingDurationSec, setRecordingDurationSec] = useState<number | null>(() =>
    typeof window !== "undefined" ? getRecordingDurationSeconds(speechName) : null
  )

  useEffect(() => {
    // Refresh duration when a new recording is saved
    const onSaved = () => {
      setRecordingDurationSec(getRecordingDurationSeconds(speechName))
    }
    window.addEventListener("debate-recording-saved", onSaved)
    return () => window.removeEventListener("debate-recording-saved", onSaved)
  }, [speechName])

  // Also re-read when speechName changes (column switching)
  useEffect(() => {
    setRecordingDurationSec(getRecordingDurationSeconds(speechName))
  }, [speechName])

  const speakerEmail = currentRound ? getSpeakerEmail(speechName, currentRound) : ""
  const hasN = speechName.includes("N")
  const hasA = speechName.includes("A")

  // Hide the timer when: timer is done AND recording duration is near the speech's allocated time
  const speechTimeSec = (debateStyle?.timerSpeeches[safeSpeechIndex]?.time ?? 0) * 60
  const hasNearFullRecording = recordingDurationSec !== null && speechTimeSec > 0 && recordingDurationSec >= speechTimeSec * NEAR_SPEECH_RATIO
  const timerDone = timerState.name === "done" || time <= 0
  const hideTimer = hasNearFullRecording && timerDone

  const speechTeamColor = hasN
    ? "bg-red-500 dark:bg-red-400"
    : hasA
      ? "bg-blue-500 dark:bg-blue-400"
      : "bg-blue-500 dark:bg-blue-400"

  const totalSpeechTimeMs = defaultTimeMs
  const progressPercent = totalSpeechTimeMs > 0
    ? Math.min(1, Math.max(0, (totalSpeechTimeMs - time) / totalSpeechTimeMs))
    : 0
  const progressActive = timerState.name === "running" && totalSpeechTimeMs > 0
  const indicatorWidthPercent = progressActive
    ? Math.min(Math.max(progressPercent * 100, 2), 100)
    : 0

  return (
    <div className="flex flex-col w-full h-full overflow-hidden py-1 px-2 gap-0.5">
      {/* Top edge bar: seekable recording progress when playing, timer progress otherwise */}
      {isRecordingPlaying ? (
        <div
          ref={progressBarPortalRef}
          className="relative w-full h-[5px] rounded-full bg-border/40 overflow-hidden cursor-pointer"
        />
      ) : (
        <div className="w-full h-[5px] rounded-full bg-border/40 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-200 ease-linear", speechTeamColor)}
            style={{ width: `${indicatorWidthPercent}%`, opacity: indicatorWidthPercent === 0 ? 0 : 1 }}
            aria-hidden="true"
          />
        </div>
      )}
      {/* Single row: name · recording playback · timer & controls */}
      <div className="flex items-center gap-1 w-full overflow-hidden min-w-0">
        {/* Speech name with navigation */}
        <div className="flex items-center shrink-0">
          {onNavigatePrev && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onNavigatePrev}
              disabled={!canNavigatePrev}
              className="h-6 w-6"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          )}
          <span
            className={`text-sm font-semibold ${hasN
              ? "text-red-600 dark:text-red-400"
              : hasA
                ? "text-blue-600 dark:text-blue-400"
                : ""
              }`}
          >
            {speechName}
          </span>
          {onNavigateNext && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onNavigateNext}
              disabled={!canNavigateNext}
              className="h-6 w-6"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Recording playback — fills middle space */}
        <div className="min-w-0 flex-1">
          <SpeechRecordingPlayer
            speechName={speechName}
            className="w-full"
            progressBarPortalRef={progressBarPortalRef}
            onPlayingChange={handleRecordingPlayingChange}
          />
        </div>

        {/* ── Timer & Controls ── */}
        <div className="flex items-center gap-1 shrink-0">
          {!hideTimer && (
            <div className="scale-[0.8] origin-right translate-x-1">
              <SpeechTimer
                speeches={debateStyle?.timerSpeeches || []}
                resetTimeIndex={safeSpeechIndex}
                time={time}
                state={timerState as any}
                onTimeChange={setTime}
                onStateChange={(state) => setTimerState(state as any)}
                onResetTimeIndexChange={() => { }}
                hideMicSelector={true}
                compact={true}
                micDeviceId={micDeviceId}
                onMicDeviceIdChange={setMicDeviceId}
                recordingEnabled={recordingEnabled}
                onRecordingEnabledChange={setRecordingEnabled}
                speechLabel={speechName}
              />
            </div>
          )}

          {/* Quote and View Mode Toggles */}
          {onQuoteViewToggle && onViewModeChange && (
            <div className="flex items-center gap-0.5 ml-0 shrink-0">
              <Button
                variant={quoteView ? "default" : "ghost"}
                size="icon"
                onClick={onQuoteViewToggle}
                className="h-6 w-6 shrink-0"
                title={quoteView ? "Disable Quote View" : "Enable Quote View"}
              >
                <Quote className="h-3.5 w-3.5" />
              </Button>
              <div className="shrink-0 scale-[0.85] origin-left ml-0.5">
                <ViewModeSelector value={viewMode} onChange={onViewModeChange} size="sm" />
              </div>
            </div>
          )}

          {/* Mic selector — to the right of the timer */}
          <MicSelector
            value={micDeviceId}
            onValueChange={setMicDeviceId}
            muted={!recordingEnabled}
            onMutedChange={(m) => setRecordingEnabled(!m)}
            disabled={false}
            className="shrink-0 scale-[0.8]"
          />

          {/* Share speech dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                title={`Share ${speechName}`}
              >
                <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => { /* TODO */ }}>
                <Lock className="h-4 w-4 mr-2" />
                Keep Private
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { /* TODO */ }}>
                <Users className="h-4 w-4 mr-2" />
                Share with Partner
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { /* TODO */ }}>
                <Radio className="h-4 w-4 mr-2" />
                Share with Round
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Open speech-doc button */}
          {onOpenSpeechPanel && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-1 shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                onOpenSpeechPanel(speechName)
              }}
              title={`Open ${speechName} speech document`}
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
