/**
 * @fileoverview Header bar for debate speeches, providing timer controls and recording management.
 */

"use client"


import React, { useState, useEffect, useRef, useCallback } from "react"
import type { Round } from "@/components/debate/DebateRound/types"
import { FileText, Quote, ChevronLeft, ChevronRight, Menu } from "lucide-react"
import type { ViewMode } from "@/lib/types/debate-flow"
import { ViewModeSelector } from "../controls/ViewModeSelector"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { SpeechRecordingPlayer, SpeechRecordingMenu } from "../../DebateTimer/SpeechRecorder/SpeechRecordingPlayer"
import { useFlowStore } from "@/lib/state/store"
import { SpeechTimer } from "../../DebateTimer/SpeechTimer"
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

/**
 * Count words that are bolded or highlighted in markdown text.
 * Matches:
 * - **bold** or __bold__
 * - ==highlight==
 * - <mark>highlight</mark>
 * - <b>bold</b> or <strong>bold</strong>
 */
function countBoldedHighlightedWords(markdown: string): number {
  if (!markdown) return 0

  let count = 0

  // Match **bold** or __bold__
  const boldPattern = /(?:\*\*|__)(.+?)(?:\*\*|__)/g
  let match
  while ((match = boldPattern.exec(markdown)) !== null) {
    const text = match[1].trim()
    count += text.split(/\s+/).filter(w => w.length > 0).length
  }

  // Match ==highlight==
  const highlightPattern = /==(.+?)==/g
  while ((match = highlightPattern.exec(markdown)) !== null) {
    const text = match[1].trim()
    count += text.split(/\s+/).filter(w => w.length > 0).length
  }

  // Match <mark>text</mark>
  const markPattern = /<mark>(.+?)<\/mark>/gi
  while ((match = markPattern.exec(markdown)) !== null) {
    const text = match[1].trim()
    count += text.split(/\s+/).filter(w => w.length > 0).length
  }

  // Match <b>text</b> or <strong>text</strong>
  const htmlBoldPattern = /<(?:b|strong)>(.+?)<\/(?:b|strong)>/gi
  while ((match = htmlBoldPattern.exec(markdown)) !== null) {
    const text = match[1].trim()
    count += text.split(/\s+/).filter(w => w.length > 0).length
  }

  return count
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
  /** When provided, renders a hamburger menu button for mobile sidebar access. */
  onMobileMenuClick?: () => void
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
  onMobileMenuClick,
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

  // Track if there's a recording for this speech
  const [hasRecording, setHasRecording] = useState(() => {
    if (typeof window === "undefined") return false
    const key = `debate-recording-${speechName}`
    return localStorage.getItem(key) !== null
  })

  useEffect(() => {
    // Refresh duration and recording status when a new recording is saved
    const onSaved = () => {
      setRecordingDurationSec(getRecordingDurationSeconds(speechName))
      const key = `debate-recording-${speechName}`
      setHasRecording(localStorage.getItem(key) !== null)
    }
    window.addEventListener("debate-recording-saved", onSaved)
    return () => window.removeEventListener("debate-recording-saved", onSaved)
  }, [speechName])

  // Also re-read when speechName changes (column switching)
  useEffect(() => {
    setRecordingDurationSec(getRecordingDurationSeconds(speechName))
    const key = `debate-recording-${speechName}`
    setHasRecording(localStorage.getItem(key) !== null)
  }, [speechName])

  // Track bolded/highlighted word count
  const [boldHighlightCount, setBoldHighlightCount] = useState(0)

  // Update word count every 15 seconds and when speech changes
  useEffect(() => {
    const updateWordCount = () => {
      if (currentFlow && speechName) {
        const speechDoc = currentFlow.speechDocs?.[speechName] || ""
        setBoldHighlightCount(countBoldedHighlightedWords(speechDoc))
      } else {
        setBoldHighlightCount(0)
      }
    }

    // Initial update
    updateWordCount()

    // Update every 15 seconds
    const interval = setInterval(updateWordCount, 15000)

    return () => clearInterval(interval)
  }, [currentFlow, speechName])

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
        {/* Mobile sidebar hamburger */}
        {onMobileMenuClick && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMobileMenuClick}
            className="h-6 w-6 shrink-0"
            aria-label="Open menu"
          >
            <Menu className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* Speech name with navigation */}
        <div className="flex items-center gap-1 shrink-0">
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
          {boldHighlightCount > 0 && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="secondary"
                    className="h-4 px-1.5 text-[10px] font-bold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-900/50"
                  >
                    {boldHighlightCount}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p>{boldHighlightCount} word{boldHighlightCount !== 1 ? 's' : ''} bolded or highlighted in speech doc</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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
            onResetSpeechTime={() => {
              setTime(defaultTimeMs)
              setTimerState({ name: "paused" })
            }}
            onSwitchToCrossX={() => {
              // Set to 3 minutes (180,000 ms)
              setTime(3 * 60 * 1000)
              setTimerState({ name: "paused" })
            }}
            micDeviceId={micDeviceId}
            onMicDeviceChange={setMicDeviceId}
            recordingEnabled={recordingEnabled}
            onRecordingEnabledChange={setRecordingEnabled}
            hideInlineMenu={true}
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

          {/* Speech menu — always show ellipsis dropdown */}
          <div className="shrink-0 scale-[0.8]">
            <SpeechRecordingMenu
              speechName={speechName}
              speechLabel={speechName}
              micDeviceId={micDeviceId}
              onMicDeviceChange={setMicDeviceId}
              recordingEnabled={recordingEnabled}
              onRecordingEnabledChange={setRecordingEnabled}
              onResetSpeechTime={() => {
                setTime(defaultTimeMs)
                setTimerState({ name: "paused" })
              }}
              onSwitchToCrossX={() => {
                setTime(3 * 60 * 1000)
                setTimerState({ name: "paused" })
              }}
              onDeleteRecording={hasRecording ? (key) => {
                localStorage.removeItem(key)
                setHasRecording(false)
                setRecordingDurationSec(null)
              } : undefined}
              recordingKey={hasRecording ? `debate-recording-${speechName}` : undefined}
              inHeader={true}
            />
          </div>

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
