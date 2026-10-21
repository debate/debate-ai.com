/**
 * @fileoverview "Timer" section of the round sidebar: the circular progress
 * timer (`CircularTimerFace` from @debate/timer) for the speech in view or a
 * prep clock, collapsible like the Cameras section, with a button that pops
 * the dial out.
 *
 * It drives the same page-level timers as the round group's speech bar and
 * prep timers, so play/pause here also reaches everyone in the round's room
 * (see `useRoomTimerSync`).
 *
 * The pop-out uses the Document Picture-in-Picture API where the browser has
 * it (Chrome, Edge): a small always-on-top window that stays visible over
 * other apps. Elsewhere the dial floats in the page's corner instead.
 *
 * The list button beside the pop-out opens "All timers": every speech and
 * prep clock with its time used and left, in speech order or ranked by most
 * time used, so the round's timing can be checked between speeches.
 */

"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, ChevronRight, ListOrdered, PictureInPicture2, Timer, X } from "lucide-react"
import {
  CircularTimerFace,
  formatCircularTimerCount,
  type CircularTimerAccent,
} from "@debate/timer/src/timers/circular/CircularTimerFace"
import type { DebateStyle, TimerSpeech, TimerState } from "@debate/timer/src/types"
import { cn } from "../ui/lib/utils"
import type { SpeechTimerEntry } from "../hooks/useTimerState"

type Focus = "speech" | "aff" | "neg"

export interface RoundTimerPanelProps {
  debateStyle: DebateStyle
  /** The speech open in the main area — the one the dial shows. */
  selectedSpeech: string
  getSpeechTimerState: (speechName: string) => SpeechTimerEntry
  setSpeechTimerState: (speechName: string, updates: Partial<SpeechTimerEntry>) => void
  prepState: TimerState | null
  setPrepState: React.Dispatch<React.SetStateAction<TimerState | null>>
  prepSecondaryState: TimerState | null
  setPrepSecondaryState: React.Dispatch<React.SetStateAction<TimerState | null>>
}

/** Ring colour for a speech: cross-ex purple, rebuttals green, constructives blue. */
export function accentForSpeech(speech: Pick<TimerSpeech, "name" | "secondary"> | undefined): CircularTimerAccent {
  if (!speech) return "constructive"
  if (speech.secondary || /cx|cross/i.test(speech.name)) return "crossx"
  if (/R$|rebuttal|summary|focus/i.test(speech.name)) return "rebuttal"
  return "constructive"
}

/** Time left on a timer right now, counting a running one down from when it started. */
export function remainingMs(entry: SpeechTimerEntry, now: number): number {
  if (entry.state.name === "running") return Math.max(0, entry.resetTime - (now - entry.state.startTime))
  if (entry.state.name === "done") return 0
  return entry.time
}

/** The next state for a play/pause click (mirrors SpeechTimer / PrepTimer). */
export function toggledEntry(entry: SpeechTimerEntry, now: number): SpeechTimerEntry {
  if (entry.state.name === "running") return { ...entry, time: remainingMs(entry, now), state: { name: "paused" } }
  if (entry.state.name === "done" || entry.time <= 0) return { ...entry, time: entry.resetTime, state: { name: "paused" } }
  return { ...entry, state: { name: "running", startTime: now - (entry.resetTime - entry.time) } }
}

/** One row of the "All timers" list. */
export interface TimerRow {
  key: string
  label: string
  kind: "speech" | "aff" | "neg"
  usedMs: number
  leftMs: number
  totalMs: number
  running: boolean
}

/** Every speech timer and prep clock, with time used and left at `now`. */
export function buildTimerRows(
  debateStyle: Pick<DebateStyle, "timerSpeeches">,
  getSpeechTimerState: (speechName: string) => SpeechTimerEntry,
  prepState: TimerState | null,
  prepSecondaryState: TimerState | null,
  now: number,
): TimerRow[] {
  const row = (key: string, label: string, kind: TimerRow["kind"], entry: SpeechTimerEntry): TimerRow => {
    const leftMs = remainingMs(entry, now)
    return {
      key,
      label,
      kind,
      leftMs,
      totalMs: entry.resetTime,
      usedMs: Math.max(0, entry.resetTime - leftMs),
      running: entry.state.name === "running",
    }
  }
  const rows = debateStyle.timerSpeeches.map((s) => row(`speech:${s.name}`, s.name, "speech", getSpeechTimerState(s.name)))
  if (prepState) rows.push(row("prep:aff", "Aff prep", "aff", prepState))
  if (prepSecondaryState) rows.push(row("prep:neg", "Neg prep", "neg", prepSecondaryState))
  return rows
}

/** Rows ranked by most time used; ties keep speech order. */
export function rankTimerRows(rows: readonly TimerRow[]): TimerRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => b.row.usedMs - a.row.usedMs || a.index - b.index)
    .map(({ row }) => row)
}

/** Re-renders every quarter second while a timer is running. */
function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    setNow(Date.now())
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [running])
  return now
}

/** Copies the page's stylesheets and theme class into a Picture-in-Picture window. */
function copyPageStyles(target: Document) {
  target.documentElement.className = document.documentElement.className
  target.documentElement.style.cssText = document.documentElement.style.cssText
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = target.createElement("style")
      style.textContent = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join("\n")
      target.head.appendChild(style)
    } catch {
      // Cross-origin sheet: its rules can't be read, so link it instead.
      if (!sheet.href) continue
      const link = target.createElement("link")
      link.rel = "stylesheet"
      link.href = sheet.href
      target.head.appendChild(link)
    }
  }
}

interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>
}

type Popout = { kind: "pip"; win: Window } | { kind: "float" } | null

export function RoundTimerPanel({
  debateStyle,
  selectedSpeech,
  getSpeechTimerState,
  setSpeechTimerState,
  prepState,
  setPrepState,
  prepSecondaryState,
  setPrepSecondaryState,
}: RoundTimerPanelProps) {
  const [open, setOpen] = useState(true)
  const [popout, setPopout] = useState<Popout>(null)
  /** Which clock the dial shows; null follows a running prep clock, else the speech. */
  const [pickedFocus, setPickedFocus] = useState<Focus | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [ranked, setRanked] = useState(false)

  const speech = debateStyle.timerSpeeches.find((s) => s.name.toUpperCase() === selectedSpeech.toUpperCase())
  const speechEntry = getSpeechTimerState(selectedSpeech)

  const autoFocus: Focus =
    prepState?.state.name === "running" ? "aff" : prepSecondaryState?.state.name === "running" ? "neg" : "speech"
  let focus: Focus = pickedFocus ?? autoFocus
  if ((focus === "aff" && !prepState) || (focus === "neg" && !prepSecondaryState)) focus = "speech"

  const shown: SpeechTimerEntry =
    focus === "aff" && prepState ? prepState : focus === "neg" && prepSecondaryState ? prepSecondaryState : speechEntry
  const anyRunning =
    [speechEntry, prepState, prepSecondaryState].some((t) => t?.state.name === "running") ||
    (listOpen && debateStyle.timerSpeeches.some((s) => getSpeechTimerState(s.name).state.name === "running"))
  const now = useNow(anyRunning)

  const left = remainingMs(shown, now)
  const progress = shown.resetTime > 0 ? 1 - left / shown.resetTime : 0
  const ticking = shown.state.name === "running"
  const label = focus === "aff" ? "Aff prep" : focus === "neg" ? "Neg prep" : selectedSpeech

  const pauseIfRunning = (entry: TimerState | null) =>
    entry && entry.state.name === "running" ? toggledEntry(entry, Date.now()) : entry

  const toggle = useCallback(() => {
    const at = Date.now()
    const next = toggledEntry(shown, at)
    const starting = next.state.name === "running"
    if (focus === "speech") {
      setSpeechTimerState(selectedSpeech, next)
      // A speech starting ends any prep that was running.
      if (starting) {
        setPrepState(pauseIfRunning)
        setPrepSecondaryState(pauseIfRunning)
      }
      return
    }
    const setThis = focus === "aff" ? setPrepState : setPrepSecondaryState
    const setOther = focus === "aff" ? setPrepSecondaryState : setPrepState
    setThis((prev) => prev && { ...prev, ...next })
    if (starting) {
      setOther(pauseIfRunning)
      if (speechEntry.state.name === "running") setSpeechTimerState(selectedSpeech, toggledEntry(speechEntry, at))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, focus, selectedSpeech, speechEntry, setSpeechTimerState, setPrepState, setPrepSecondaryState])

  const prepButton = (which: "aff" | "neg", entry: TimerState | null) =>
    entry && {
      key: which,
      label: formatCircularTimerCount(remainingMs(entry, now)),
      accent: which,
      active: focus === which,
      title: `${which === "aff" ? "Aff" : "Neg"} prep`,
      onClick: () => setPickedFocus(which),
    }

  const face = (size: string) => (
    <CircularTimerFace
      style={{ "--dt-ctimer-size": size } as React.CSSProperties}
      progress={progress}
      countText={formatCircularTimerCount(left)}
      title={label}
      ticking={ticking}
      accent={focus === "speech" ? accentForSpeech(speech) : focus}
      onToggle={toggle}
      countLabel={`${label} time remaining`}
      speechButtons={[
        {
          key: "speech",
          label: selectedSpeech,
          accent: accentForSpeech(speech),
          active: focus === "speech",
          title: "Show the speech timer",
          onClick: () => setPickedFocus("speech"),
        },
      ]}
      prepButtons={[prepButton("aff", prepState), prepButton("neg", prepSecondaryState)].filter(
        (b): b is NonNullable<typeof b> => Boolean(b),
      )}
    />
  )

  const popoutRef = useRef<Popout>(null)
  popoutRef.current = popout

  const closePopout = useCallback(() => {
    const current = popoutRef.current
    if (current?.kind === "pip") current.win.close()
    setPopout(null)
  }, [])

  const openPopout = async () => {
    if (popout) {
      closePopout()
      return
    }
    const pip = (window as Window & { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture
    if (pip) {
      try {
        const win = await pip.requestWindow({ width: 300, height: 300 })
        copyPageStyles(win.document)
        Object.assign(win.document.body.style, {
          margin: "0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "var(--background, #fff)",
        })
        win.document.title = "Round timer"
        win.addEventListener("pagehide", () => setPopout(null), { once: true })
        setPopout({ kind: "pip", win })
        return
      } catch {
        // Refused (no user gesture, or blocked): fall back to the floating dial.
      }
    }
    setPopout({ kind: "float" })
  }

  // Close a Picture-in-Picture window when the sidebar goes away.
  useEffect(() => () => closePopout(), [closePopout])

  return (
    <div className="pb-[var(--padding)]">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[var(--border-radius)] p-[var(--padding)] text-left hover:bg-[var(--background-indent)]"
          aria-expanded={open}
        >
          {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          <Timer className={cn("h-3.5 w-3.5 shrink-0", anyRunning ? "text-green-600" : "text-muted-foreground")} />
          <span className="flex-1 truncate text-sm font-bold">Timer</span>
          {(!open || popout) && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {label} {formatCircularTimerCount(left)}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setListOpen((v) => !v)}
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--border-radius)] hover:bg-[var(--background-indent)]",
            listOpen && "bg-[var(--background-active)]",
          )}
          aria-pressed={listOpen}
          aria-expanded={listOpen}
          title={listOpen ? "Hide all timers" : "Show all timers"}
        >
          <ListOrdered className="h-3.5 w-3.5" />
          <span className="sr-only">{listOpen ? "Hide all timers" : "Show all timers"}</span>
        </button>
        <button
          type="button"
          onClick={() => void openPopout()}
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--border-radius)] hover:bg-[var(--background-indent)]",
            popout && "bg-[var(--background-active)]",
          )}
          aria-pressed={Boolean(popout)}
          title={popout ? "Close the pop-out timer" : "Pop out the timer"}
        >
          <PictureInPicture2 className="h-3.5 w-3.5" />
          <span className="sr-only">{popout ? "Close the pop-out timer" : "Pop out the timer"}</span>
        </button>
      </div>

      {open && !popout && <div className="px-2 pt-1">{face("220px")}</div>}
      {open && popout && (
        <p className="px-2 pt-1 text-[11px] text-muted-foreground">
          The timer is popped out.{" "}
          <button type="button" className="underline" onClick={closePopout}>
            Bring it back
          </button>
        </p>
      )}

      {listOpen && (
        <TimerList
          rows={(() => {
            const rows = buildTimerRows(debateStyle, getSpeechTimerState, prepState, prepSecondaryState, now)
            return ranked ? rankTimerRows(rows) : rows
          })()}
          ranked={ranked}
          onRankedChange={setRanked}
          currentKey={focus === "speech" ? `speech:${speech?.name ?? selectedSpeech}` : `prep:${focus}`}
          onPick={(row) => {
            if (row.kind !== "speech") setPickedFocus(row.kind)
          }}
        />
      )}

      {popout?.kind === "pip" && createPortal(face("min(92vw, 92vh)"), popout.win.document.body)}
      {popout?.kind === "float" &&
        createPortal(
          <div
            role="dialog"
            aria-label="Round timer"
            className="fixed bottom-4 right-4 z-50 rounded-full shadow-xl"
          >
            {face("200px")}
            <button
              type="button"
              onClick={closePopout}
              className="absolute -right-1 -top-1 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-[var(--background)] shadow"
              title="Close the pop-out timer"
            >
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">Close the pop-out timer</span>
            </button>
          </div>,
          document.body,
        )}
    </div>
  )
}

interface TimerListProps {
  rows: TimerRow[]
  ranked: boolean
  onRankedChange: (ranked: boolean) => void
  currentKey: string
  onPick: (row: TimerRow) => void
}

/** The "All timers" list: each clock's time used, left and a progress bar. */
function TimerList({ rows, ranked, onRankedChange, currentKey, onPick }: TimerListProps) {
  return (
    <div className="px-2 pt-2" aria-label="All timers">
      <div className="mb-1 flex items-center gap-1 text-[11px]">
        <span className="flex-1 font-semibold">All timers</span>
        {(["order", "used"] as const).map((mode) => {
          const active = (mode === "used") === ranked
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onRankedChange(mode === "used")}
              aria-pressed={active}
              className={cn(
                "rounded px-1.5 py-0.5",
                active ? "bg-[var(--background-active)] font-semibold" : "text-muted-foreground hover:bg-[var(--background-indent)]",
              )}
            >
              {mode === "order" ? "Speech order" : "Most used"}
            </button>
          )
        })}
      </div>
      <ol className="space-y-1">
        {rows.map((row, index) => {
          const share = row.totalMs > 0 ? Math.min(1, row.usedMs / row.totalMs) : 0
          const current = row.key === currentKey
          return (
            <li key={row.key}>
              <button
                type="button"
                onClick={() => onPick(row)}
                disabled={row.kind === "speech"}
                className={cn(
                  "w-full rounded px-1.5 py-1 text-left text-xs disabled:cursor-default",
                  current ? "bg-[var(--background-active)]" : row.kind !== "speech" && "hover:bg-[var(--background-indent)]",
                )}
                title={`${row.label}: ${formatCircularTimerCount(row.usedMs)} used, ${formatCircularTimerCount(row.leftMs)} left`}
              >
                <span className="flex items-center gap-1.5">
                  {ranked && <span className="w-4 text-right font-mono text-[10px] text-muted-foreground">{index + 1}</span>}
                  <span className={cn("flex-1 truncate", current && "font-semibold")}>
                    {row.label}
                    {row.running && <span className="ml-1 text-green-600">●</span>}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {formatCircularTimerCount(row.usedMs)} / {formatCircularTimerCount(row.totalMs)}
                  </span>
                </span>
                <span className="mt-0.5 block h-1 overflow-hidden rounded bg-muted">
                  <span
                    className={cn(
                      "block h-full",
                      row.kind === "aff" ? "bg-blue-500" : row.kind === "neg" ? "bg-red-500" : "bg-green-600",
                    )}
                    style={{ width: `${Math.round(share * 100)}%` }}
                  />
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
