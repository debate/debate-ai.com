"use client"

/**
 * @fileoverview Timers Panel Component
 *
 * Container component that renders all debate timers including:
 * - Speech timer with speech selection
 * - Prep time timers for each team
 * - Voice chat integration when participants are available
 *
 * Timer state is owned by the parent (via useTimerState hook) so it
 * persists when the mobile sidebar unmounts.
 *
 * @module components/debate/timers/TimersPanel
 */

import type React from "react"
import { PrepTimer } from "./PrepTimer"
import { SpeechTimer } from "./SpeechTimer"
import { VoiceChat } from "@/components/ui/voice-chat"
import { useFlowStore } from "@/lib/state/store"

/**
 * Generate participant data from email address.
 * Creates a display name and random avatar.
 *
 * @param email - Email address of the participant
 * @param index - Participant index (first is speaking by default)
 * @returns Participant object with id, name, avatar, and speaking status
 */
function getParticipantFromEmail(email: string, index: number) {
  const name = email.split("@")[0]
  // Generate a unique avatar based on email
  const seed = email.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const avatarId = (seed % 70) + 1
  return {
    id: email,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    avatar: `https://i.pravatar.cc/150?img=${avatarId}`,
    isSpeaking: index === 0,
  }
}

/** Props for the TimersPanel component. */
interface TimersPanelProps {
  /** The current debate style configuration. */
  debateStyle: DebateStyle
  /** Current speech timer state. */
  speechState: SpeechTimerState
  /** Setter for speech timer state. */
  setSpeechState: React.Dispatch<React.SetStateAction<SpeechTimerState>>
  /** Current primary prep timer state (null if no prep time). */
  prepState: TimerState | null
  /** Setter for primary prep timer state. */
  setPrepState: React.Dispatch<React.SetStateAction<TimerState | null>>
  /** Current secondary prep timer state (null if no prep time). */
  prepSecondaryState: TimerState | null
  /** Setter for secondary prep timer state. */
  setPrepSecondaryState: React.Dispatch<React.SetStateAction<TimerState | null>>
}

/**
 * TimersPanel - Container for all debate timers.
 *
 * Renders speech timer, prep timers, and voice chat based on the
 * current debate style and round participants. Timer state is
 * controlled via props from the page-level useTimerState hook.
 *
 * @returns The timers panel component
 */
export function TimersPanel({
  debateStyle,
  speechState,
  setSpeechState,
  prepState,
  setPrepState,
  prepSecondaryState,
  setPrepSecondaryState,
}: TimersPanelProps) {
  // Get current round for participant info
  const { rounds, flows, selected } = useFlowStore()
  const currentFlow = flows[selected]
  const currentRound = currentFlow?.roundId ? rounds.find((r) => r.id === currentFlow.roundId) : undefined

  /**
   * Participants list derived from the current round.
   * Includes debaters and judges with unique composite IDs.
   */
  const participants = currentRound
    ? [
        ...currentRound.debaters.aff.map((email: string, i: number) => ({
          ...getParticipantFromEmail(email, i),
          id: `aff-${i}-${email}`,
        })),
        ...currentRound.debaters.neg.map((email: string, i: number) => ({
          ...getParticipantFromEmail(email, i + 2),
          id: `neg-${i}-${email}`,
        })),
        ...currentRound.judges.map((email: string, i: number) => ({
          ...getParticipantFromEmail(email, i + 4),
          id: `judge-${i}-${email}`,
        })),
      ]
    : []

  return (
    <div className="flex flex-col gap-[var(--padding)]">
      {/* Speech Timer */}
      <div className="flex justify-center w-full">
        <SpeechTimer
          speeches={debateStyle.timerSpeeches}
          resetTimeIndex={speechState.resetTimeIndex}
          time={speechState.time}
          state={speechState.state}
          onResetTimeIndexChange={(index) => setSpeechState((prev) => ({ ...prev, resetTimeIndex: index }))}
          onTimeChange={(time) => setSpeechState((prev) => ({ ...prev, time }))}
          onStateChange={(state) => {
            setSpeechState((prev) => ({ ...prev, state }))
            if (state.name === "running") {
              // Pause prep timers when speech starts
              setPrepState((prev) => prev && prev.state.name === "running" ? { ...prev, state: { name: "paused" } } : prev)
              setPrepSecondaryState((prev) => prev && prev.state.name === "running" ? { ...prev, state: { name: "paused" } } : prev)
            }
          }}
          onFinish={() => {
            // Auto-advance to next speech when timer finishes
            setSpeechState((prev) => {
              const nextIndex = prev.resetTimeIndex + 1
              if (nextIndex < debateStyle.timerSpeeches.length) {
                return {
                  resetTimeIndex: nextIndex,
                  time: debateStyle.timerSpeeches[nextIndex].time,
                  state: { name: "paused" },
                }
              }
              return { ...prev, time: 0, state: { name: "done" } }
            })
          }}
          currentRound={currentRound}
        >
          {/* Prep Timers inside the ring */}
          {(prepState || prepSecondaryState) && (
            <div className="flex flex-col gap-0 w-full">
              {prepState && (
                <PrepTimer
                  resetTime={prepState.resetTime}
                  time={prepState.time}
                  state={prepState.state}
                  palette="accent-secondary"
                  color="blue"
                  compact
                  onTimeChange={(time) => setPrepState((prev) => prev && { ...prev, time })}
                  onStateChange={(state) => {
                    setPrepState((prev) => prev && { ...prev, state })
                    if (state.name === "running") {
                      // Pause speech and other prep timer
                      setSpeechState((prev) => prev.state.name === "running" ? { ...prev, state: { name: "paused" } } : prev)
                      setPrepSecondaryState((prev) => prev && prev.state.name === "running" ? { ...prev, state: { name: "paused" } } : prev)
                    }
                  }}
                />
              )}
              {prepSecondaryState && (
                <PrepTimer
                  resetTime={prepSecondaryState.resetTime}
                  time={prepSecondaryState.time}
                  state={prepSecondaryState.state}
                  palette="accent-secondary"
                  color="red"
                  compact
                  onTimeChange={(time) => setPrepSecondaryState((prev) => prev && { ...prev, time })}
                  onStateChange={(state) => {
                    setPrepSecondaryState((prev) => prev && { ...prev, state })
                    if (state.name === "running") {
                      // Pause speech and other prep timer
                      setSpeechState((prev) => prev.state.name === "running" ? { ...prev, state: { name: "paused" } } : prev)
                      setPrepState((prev) => prev && prev.state.name === "running" ? { ...prev, state: { name: "paused" } } : prev)
                    }
                  }}
                />
              )}
            </div>
          )}
        </SpeechTimer>
      </div>

      {/* Voice Chat (if participants available) */}
      {participants.length > 0 && (
        <div className="flex justify-center w-full">
          <VoiceChat participants={participants} />
        </div>
      )}
    </div>
  )
}
