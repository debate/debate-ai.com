/**
 * @fileoverview Header bar for debate speeches, providing timer controls and recording management.
 */

"use client"


import { useState, useEffect } from "react"
import type { Round } from "@/lib/types/debate"
import { FileText, Share2, Lock, Users, Radio } from "lucide-react"
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

const LONG_RECORDING_THRESHOLD_SECONDS = 5 * 60 // 5 minutes

export interface SpeechHeaderBarProps {
  /** The speech/column name, e.g. "1AR", "2NC". */
  speechName: string
  /** If provided, renders a speech-doc icon button. */
  onOpenSpeechPanel?: (speechName: string) => void
}

export function SpeechHeaderBar({ speechName, onOpenSpeechPanel }: SpeechHeaderBarProps) {
  const { rounds, flows, selected } = useFlowStore()
  const currentFlow = flows[selected]
  const currentRound = currentFlow?.roundId
    ? rounds.find((r) => r.id === currentFlow.roundId)
    : undefined

  const [micDeviceId, setMicDeviceId] = useState<string | undefined>()
  const [recordingEnabled, setRecordingEnabled] = useState(false)

  // -- Timer State --
  const currentDebateStyleIndex = (settings.data.debateStyle?.value as number) ?? 0
  const currentStyleKey = debateStyleMap[currentDebateStyleIndex]
  const debateStyle = debateStyles[currentStyleKey]

  const speechIndex = debateStyle?.timerSpeeches.findIndex((s: any) => s.name.toUpperCase() === speechName.toUpperCase()) ?? -1
  const safeSpeechIndex = speechIndex !== -1 ? speechIndex : 0
  const defaultTimeMs = debateStyle?.timerSpeeches[safeSpeechIndex]?.time * 60 * 1000 || 0

  const [time, setTime] = useState(defaultTimeMs)
  const [timerState, setTimerState] = useState<
    { name: "paused" } | { name: "running", startTime: number } | { name: "done" }
  >({ name: "paused" })

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

  // Hide the timer when: there's a recording >= 5 min AND the timer is at 0 / done
  const hasLongRecording = recordingDurationSec !== null && recordingDurationSec >= LONG_RECORDING_THRESHOLD_SECONDS
  const timerDone = timerState.name === "done" || time <= 0
  const hideTimer = hasLongRecording && timerDone

  return (
    <div className="flex flex-col w-full h-full overflow-hidden py-1 px-2 gap-0.5">
      {/* Row 1: name · email · controls */}
      <div className="flex items-center gap-1 w-full overflow-hidden min-w-0">
        {/* Speech name */}
        <span
          className={`text-sm font-semibold shrink-0 ${hasN
            ? "text-red-600 dark:text-red-400"
            : hasA
              ? "text-blue-600 dark:text-blue-400"
              : ""
            }`}
        >
          {speechName}
        </span>

        {/* Speaker email */}
        <div className="min-w-0 flex-1 truncate ml-1">
          {speakerEmail && (
            <span className="text-[10px] text-muted-foreground truncate">
              {speakerEmail}
            </span>
          )}
        </div>

        {/* ── Timer & Doc ── */}
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
                Share with Team
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { /* TODO */ }}>
                <Radio className="h-4 w-4 mr-2" />
                Share with Debate Room
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

      {/* Row 2: Recording playback bar — full width below controls */}
      <SpeechRecordingPlayer speechName={speechName} className="w-full" />
    </div>
  )
}
