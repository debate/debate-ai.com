/**
 * @fileoverview Collapsible round tree node for the sidebar: the selected
 * round (the one the active flow tab belongs to, or the live round when the
 * tab isn't tied to one), its prep timers, and the full timer/controls bar
 * for whichever speech is currently selected in the main content area.
 *
 * This is the app's only round-timer surface — the dock's Timer shortcut was
 * removed in favour of timing a round from the round it belongs to.
 * Other speeches in the round are listed by name with their word totals
 * (read from the speech doc · orally spoken) — the bar (and its timer) only
 * ever tracks the one speech in view, matching CardMirror, which only ever
 * has one live editable speech at a time. The selected speech's recording
 * menu (mic selector with live waveform, resets, upload/share/delete) sits
 * on its own row under the speech here, rather than in the page topbar, and
 * the speech view controls (quote view, view mode, split layout, open speech
 * document) sit above the speech list.
 *
 * Any other speech in the list can be clicked to make it the active one.
 * When the viewer is one of the round's debaters, the speeches they give are
 * highlighted and tagged "You" (see `round/my-speeches.ts`).
 */

"use client"

import { useMemo, useState, type ReactNode } from "react"
import { ChevronDown, ChevronRight, Radio, Timer } from "lucide-react"
import { PrepTimer } from "@debate/timer/src/timers/PrepTimer"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/primitives/tooltip"
import { cn } from "../ui/lib/utils"
import { SpeechHeaderBar } from "./SpeechHeaderBar"
import { SpeechWordStats } from "@debate/timer/src/timers/SpeechWordStats"
import { useSpeechWordStats } from "../hooks/useSpeechWordStats"
import { useFlowStore } from "../state/store"
import type { Round } from "../types/flow"
import { findViewerSeat, isViewerSpeech } from "../round/my-speeches"
import type { DebateStyle, SpeechTimerState, TimerState } from "@debate/timer/src/types"
import type { SpeechTimerEntry } from "../hooks/useTimerState"

interface LiveRoundGroupProps {
  /** The round the sidebar is showing — selected, and not necessarily live. */
  round: Round
  /** Whether that round is in progress; drives the red "on air" marker. */
  isLive?: boolean
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
  /** Name of the speech currently open in the main content area — the only
   *  one whose full timer/controls bar is shown here. */
  selectedSpeech: string
  /** Callback to reset prep timers to their defaults. */
  onResetPrepTimers?: () => void
  /** Whether backward speech navigation is available. */
  canNavigatePrev?: boolean
  /** Whether forward speech navigation is available. */
  canNavigateNext?: boolean
  /** Handler called when the user navigates to the previous speech. */
  onNavigatePrev?: () => void
  /** Handler called when the user navigates to the next speech. */
  onNavigateNext?: () => void
  /** Selected microphone device ID, shared with the global speech controls topbar. */
  micDeviceId?: string
  /** Callback when the microphone device changes. */
  onMicDeviceChange?: (deviceId: string | undefined) => void
  /** Whether recording is enabled, shared with the global speech controls topbar. */
  recordingEnabled?: boolean
  /** Callback when the recording-enabled flag changes. */
  onRecordingEnabledChange?: (enabled: boolean) => void
  /** The selected speech's view controls, shown above the speech list. */
  viewControls?: ReactNode
  /** Makes a non-active speech the active one when its row is clicked. */
  onSelectSpeech?: (speechName: string) => void
  /** The viewer's email(s) — speeches they give in this round are highlighted. */
  viewerEmails?: readonly (string | null | undefined)[]
}

/** The "You" tag on a speech the viewer gives. */
function MineBadge() {
  return (
    <span className="shrink-0 rounded-full bg-amber-400/90 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-amber-950">
      You
    </span>
  )
}

/** A non-selected speech's row: its name and word totals. Clicking it makes
 *  it the active speech when `onSelect` is given. */
function SpeechTotalsRow({
  name,
  secondary,
  mine = false,
  onSelect,
}: {
  name: string
  secondary: boolean
  mine?: boolean
  onSelect?: (name: string) => void
}) {
  const { flows, selected } = useFlowStore()
  const { stats, spoken } = useSpeechWordStats(flows[selected], name)
  const className = cn(
    "flex w-full items-center gap-2 rounded-[var(--border-radius)] px-2 py-1 text-left text-xs font-medium text-muted-foreground",
    secondary ? "text-red-600/70 dark:text-red-400/70" : "text-blue-600/70 dark:text-blue-400/70",
    mine && "border-l-4 border-amber-400 bg-amber-400/10 font-bold",
    onSelect && "cursor-pointer hover:bg-[var(--background-indent)]",
  )
  const content = (
    <>
      <span className="flex-1 truncate">{name}</span>
      {mine && <MineBadge />}
      <SpeechWordStats speechName={name} stats={stats} spoken={spoken} variant="inline" />
    </>
  )
  if (!onSelect) {
    return (
      <div className={className} data-mine={mine || undefined}>
        {content}
      </div>
    )
  }
  return (
    <button
      type="button"
      className={className}
      onClick={() => onSelect(name)}
      title={`Make ${name} the active speech`}
      data-mine={mine || undefined}
    >
      {content}
    </button>
  )
}

/** The round's display title, falling back to the tournament/level pair. */
function roundLabel(round: Round, isLive: boolean): string {
  if (round.title) return round.title
  const parts = [round.tournamentName, round.roundLevel].filter(Boolean)
  if (parts.length) return parts.join(" - ")
  return isLive ? "Live Round" : "Round"
}

export function LiveRoundGroup({
  round,
  isLive = false,
  isMobile,
  debateStyle,
  getSpeechTimerState,
  setSpeechTimerState,
  setSpeechState,
  prepState,
  setPrepState,
  prepSecondaryState,
  setPrepSecondaryState,
  selectedSpeech,
  onResetPrepTimers,
  canNavigatePrev,
  canNavigateNext,
  onNavigatePrev,
  onNavigateNext,
  micDeviceId,
  onMicDeviceChange,
  recordingEnabled,
  onRecordingEnabledChange,
  viewControls,
  onSelectSpeech,
  viewerEmails,
}: LiveRoundGroupProps) {
  const [open, setOpen] = useState(true)
  const seat = useMemo(() => findViewerSeat(round, viewerEmails ?? []), [round, viewerEmails])

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
        {isLive ? (
          <Radio className="h-3.5 w-3.5 shrink-0 text-red-500 dark:text-red-400" aria-hidden="true" />
        ) : (
          <Timer className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="flex-1 truncate text-sm font-bold">{roundLabel(round, isLive)}</span>
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

          {viewControls && <div className="pb-1">{viewControls}</div>}

          {seat && (
            <p className="px-2 pb-1 text-[11px] text-muted-foreground">
              Your speeches are tagged <MineBadge />
            </p>
          )}

          <div className="flex flex-col gap-1">
            {speeches.map((speech) => {
              const isSelected = speech.name.toUpperCase() === selectedSpeech.toUpperCase()
              const mine = isViewerSpeech(speech, seat)

              if (isSelected) {
                const entry = getSpeechTimerState(speech.name)
                return (
                  <div
                    key={speech.name}
                    data-mine={mine || undefined}
                    className={cn(
                      "rounded-[var(--border-radius)] border bg-[var(--background-active)] overflow-hidden",
                      mine ? "border-2 border-amber-400" : "border-border",
                    )}
                  >
                    {mine && (
                      <div className="flex items-center gap-1.5 bg-amber-400/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                        <MineBadge />
                        Your speech
                      </div>
                    )}
                    <SpeechHeaderBar
                      speechName={speech.name}
                      controlledTime={entry.time}
                      controlledResetTime={entry.resetTime}
                      controlledTimerRunState={entry.state}
                      onControlledTimeChange={(time) => setSpeechTimerState(speech.name, { time })}
                      onControlledResetTimeChange={(resetTime) => setSpeechTimerState(speech.name, { resetTime })}
                      onControlledTimerRunStateChange={(state) => setSpeechTimerState(speech.name, { state })}
                      onResetPrepTimers={onResetPrepTimers}
                      canNavigatePrev={canNavigatePrev}
                      canNavigateNext={canNavigateNext}
                      onNavigatePrev={onNavigatePrev}
                      onNavigateNext={onNavigateNext}
                      showRecordingMenu={true}
                      recordingMenuPlacement="below"
                      micDeviceId={micDeviceId}
                      onMicDeviceChange={onMicDeviceChange}
                      recordingEnabled={recordingEnabled}
                      onRecordingEnabledChange={onRecordingEnabledChange}
                    />
                  </div>
                )
              }

              return (
                <SpeechTotalsRow
                  key={speech.name}
                  name={speech.name}
                  secondary={speech.secondary}
                  mine={mine}
                  onSelect={onSelectSpeech}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
