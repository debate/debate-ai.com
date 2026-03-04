"use client"

import { useState } from "react"
import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SpeechRecordingPlayer } from "../SpeechRecorder/SpeechRecordingPlayer"
import { MicSelector } from "../SpeechRecorder/mic-selector"
import { useFlowStore } from "@/lib/state/store"
import { SpeechTimer } from "../DebateTimer/SpeechTimer"
import { debateStyles, debateStyleMap } from "../DebateTimer/debate-format-times"
import { settings } from "@/lib/state/settings"

// Extract type from hook instead of importing if it's not exported, or just use inline type
import { type TimerState } from "../hooks/useTimerState"

/** Resolve which debater email corresponds to a given speech column name. */
function getSpeakerEmail(speechName: string, round: Round): string {
  const lower = speechName.toLowerCase()
  if (lower.includes("1a") || lower === "ac") return round.debaters.aff[0] ?? ""
  if (lower.includes("2a")) return round.debaters.aff[1] ?? ""
  if (lower.includes("1n") || lower === "nc") return round.debaters.neg[0] ?? ""
  if (lower.includes("2n")) return round.debaters.neg[1] ?? ""
  return ""
}

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
  const [timerState, setTimerState] = useState<{ name: "paused" | "running" | "done", startTime?: number }>({ name: "paused" })

  const speakerEmail = currentRound ? getSpeakerEmail(speechName, currentRound) : ""

  const hasN = speechName.includes("N")
  const hasA = speechName.includes("A")

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

        {/* ── Controls ── */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="scale-[0.55] origin-right translate-x-3 translate-y-[2px] w-[110px]">
            <SpeechTimer
              speeches={debateStyle?.timerSpeeches || []}
              resetTimeIndex={safeSpeechIndex}
              time={time}
              state={timerState}
              onTimeChange={setTime}
              onStateChange={setTimerState}
              onResetTimeIndexChange={() => { }}
              hideMicSelector={true}
              speechLabel={speechName}
            />
          </div>

          {/* Open speech-doc button */}
          {onOpenSpeechPanel && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-1"
              onClick={(e) => {
                e.stopPropagation()
                onOpenSpeechPanel(speechName)
              }}
              title={`Open ${speechName} speech document`}
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}

          {/* Mic selector */}
          <MicSelector
            value={micDeviceId}
            onValueChange={setMicDeviceId}
            muted={!recordingEnabled}
            onMutedChange={(m) => setRecordingEnabled(!m)}
            className="scale-75 origin-right"
          />
        </div>
      </div>

      {/* Row 2: recording playbar (hidden when no recording) */}
      <SpeechRecordingPlayer speechName={speechName} className="w-full" />
    </div>
  )
}
