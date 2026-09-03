/**
 * @fileoverview Collapsible "live round" tree node for the sidebar: the
 * round currently in progress, its prep timers, and a timer for each of its
 * speeches — a sidebar-resident mirror of the timers driven from the main
 * SpeechHeaderBar toolbar (they share the same per-speech timer state, keyed
 * by speech name, so starting a speech's timer from either place updates
 * both).
 */

"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Radio } from "lucide-react"
import { PrepTimer } from "debate-timer/src/timers/PrepTimer"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/primitives/tooltip"
import { cn } from "../ui/lib/utils"
import type { Round } from "../types/flow"
import type { DebateStyle, SpeechTimerState, TimerState } from "debate-timer/src/types"
import type { SpeechTimerEntry } from "../hooks/useTimerState"

interface LiveRoundGroupProps {
  /** The round currently in progress. */
  round: Round
  /** Whether this is rendered inside the mobile sidebar sheet. */
  isMobile: boolean
  debateStyle: DebateStyle
  getSpeechTimerState: (speechName: string) => SpeechTimerEntry
  setSpeechTimerState: (speechName: string, updates: Partial<SpeechTimerEntry>) => void
  setSpeechState: React.Dispatch<React.SetStateAction<SpeechTimerState>>
  prepState: TimerState | null
  setPrepState: React.Dispatch<React.SetStateAction<TimerState | null>>
  prepSecondaryState: TimerState | null
  setPrepSecondaryState: React.Dispatch<React.SetStateAction<TimerState | null>>
}

/** The round's display title, falling back to the tournament/level pair. */
function roundLabel(round: Round): string {
  if (round.title) return round.title
  const parts = [round.tournamentName, round.roundLevel].filter(Boolean)
  return parts.length ? parts.join(" - ") : "Live Round"
}

export function LiveRoundGroup({
  round,
  isMobile,
  debateStyle,
  getSpeechTimerState,
  setSpeechTimerState,
  setSpeechState,
  prepState,
  setPrepState,
  prepSecondaryState,
  setPrepSecondaryState,
}: LiveRoundGroupProps) {
  const [open, setOpen] = useState(true)

  // The main speeches only — cross-ex blocks share a speaker's time budget
  // rather than owning one of their own, so they don't get a timer row here.
  const speeches = debateStyle.timerSpeeches.filter((s) => s.name !== "CX")

  return (
    <div className="pb-[var(--padding)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded-[var(--border-radius)] p-[var(--padding)] text-left hover:bg-[var(--background-indent)]"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        <Radio className="h-3.5 w-3.5 shrink-0 text-red-500 dark:text-red-400" aria-hidden="true" />
        <span className="flex-1 truncate text-sm font-bold">{roundLabel(round)}</span>
      </button>

      {open && (
        <div className="pl-2">
          {(prepState || prepSecondaryState) && (
            <TooltipProvider>
              <div className="flex flex-row gap-0 pb-1">
                {prepState && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex-1">
                        <PrepTimer
                          resetTime={prepState.resetTime}
                          time={prepState.time}
                          state={prepState.state}
                          palette="accent-secondary"
                          color="blue"
                          compact
                          hideControlsByDefault={isMobile}
                          onTimeChange={(time) => setPrepState((prev) => prev && { ...prev, time })}
                          onStateChange={(state) => {
                            setPrepState((prev) => prev && { ...prev, state })
                            if (state.name === "running") {
                              setSpeechState((prev) =>
                                prev.state.name === "running" ? { ...prev, state: { name: "paused" } } : prev,
                              )
                              setPrepSecondaryState((prev) =>
                                prev && prev.state.name === "running"
                                  ? { ...prev, state: { name: "paused" } }
                                  : prev,
                              )
                            }
                          }}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent><p>Aff Prep</p></TooltipContent>
                  </Tooltip>
                )}
                {prepSecondaryState && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex-1">
                        <PrepTimer
                          resetTime={prepSecondaryState.resetTime}
                          time={prepSecondaryState.time}
                          state={prepSecondaryState.state}
                          palette="accent-secondary"
                          color="red"
                          compact
                          hideControlsByDefault={isMobile}
                          onTimeChange={(time) => setPrepSecondaryState((prev) => prev && { ...prev, time })}
                          onStateChange={(state) => {
                            setPrepSecondaryState((prev) => prev && { ...prev, state })
                            if (state.name === "running") {
                              setSpeechState((prev) =>
                                prev.state.name === "running" ? { ...prev, state: { name: "paused" } } : prev,
                              )
                              setPrepState((prev) =>
                                prev && prev.state.name === "running"
                                  ? { ...prev, state: { name: "paused" } }
                                  : prev,
                              )
                            }
                          }}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent><p>Neg Prep</p></TooltipContent>
                  </Tooltip>
                )}
              </div>
            </TooltipProvider>
          )}

          <div className="grid grid-cols-2 gap-1">
            {speeches.map((speech) => {
              const entry = getSpeechTimerState(speech.name)
              return (
                <div
                  key={speech.name}
                  className={cn(
                    "rounded-[var(--border-radius)]",
                    entry.state.name === "running" && "bg-[var(--background-active)]",
                  )}
                >
                  <PrepTimer
                    resetTime={entry.resetTime}
                    time={entry.time}
                    state={entry.state}
                    label={speech.name}
                    color={speech.secondary ? "red" : "blue"}
                    compact
                    hideControlsByDefault={isMobile}
                    onTimeChange={(time) => setSpeechTimerState(speech.name, { time })}
                    onStateChange={(state) => setSpeechTimerState(speech.name, { state })}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
