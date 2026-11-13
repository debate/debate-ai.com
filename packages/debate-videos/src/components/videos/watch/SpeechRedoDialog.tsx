/**
 * @fileoverview "Do the full speech" — the dialog an alternative's redo
 * button opens on the watch page's Alternatives view.
 *
 * On open it asks Claude for the complete speech in that alternative's
 * direction (prompt in `lib/speech-redo.ts`, from the prior speech and the
 * speech as given), then shows it in the **Debate Editor** so the reader can
 * rewrite it. Above the editor sits the round's own **speech timer**, set to
 * the speech's length, with its mic toggle: starting the timer records the
 * reader delivering the speech, and the recording plays back underneath
 * (the same `SpeechTimer` / `SpeechRecordingPlayer` pair a live round uses,
 * under a redo-only recording name so it never overwrites a round's).
 *
 * The speech and the reader's edits are kept in this browser per video,
 * speech and alternative, so reopening shows the edited version; **Write
 * again** asks for a fresh one.
 * @module components/watch/SpeechRedoDialog
 */

"use client"

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Check, Copy, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { SpeechRecordingPlayer, SpeechTimer, type SpeechTimerState } from "@debate-ai/timer"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../ui/primitives/dialog"
import type { RoundSpeech } from "../../../lib/round-speeches"
import type { AlternativeResponse, RoundContext } from "../../../lib/speech-outcomes"
import {
  redoSpeechMinutes,
  speechRedoRecordingName,
  speechRedoStorageKey,
  speechRedoToHtml,
} from "../../../lib/speech-redo"
import { requestSpeechRedo } from "../../../lib/speech-redo-client"

/**
 * The Debate Editor engine (ProseMirror, its codecs and stylesheet) loads
 * only when a redo is opened, never with the watch page.
 */
const SpeechRedoEditor = lazy(() =>
  import("@debate-ai/editor").then((m) => ({ default: m.EditorWithToolbar })),
)

interface StoredRedo {
  html: string
  savedAt: number
}

function readStoredRedo(key: string): StoredRedo | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredRedo>
    return typeof parsed.html === "string" && parsed.html.trim()
      ? { html: parsed.html, savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now() }
      : null
  } catch {
    return null
  }
}

function writeStoredRedo(key: string, html: string): void {
  try {
    window.localStorage.setItem(key, JSON.stringify({ html, savedAt: Date.now() } satisfies StoredRedo))
  } catch {
    // Storage full or blocked — the edit still holds while the dialog is open.
  }
}

/** Plain text of the editor's HTML, for the clipboard. */
function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html")
  doc.querySelectorAll("h1,h2,h3,h4,p,li").forEach((el) => el.append("\n"))
  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim()
}

export interface SpeechRedoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  videoId: string
  videoTitle?: string
  speeches: RoundSpeech[]
  /** Index of the speech being redone. */
  index: number
  /** The alternative's place in the run, for the recording's name. */
  alternativeIndex: number
  alternative: AlternativeResponse
  round?: RoundContext
  roundTranscript?: string
}

type Status = { state: "idle" } | { state: "loading" } | { state: "error"; message: string }

export function SpeechRedoDialog({
  open,
  onOpenChange,
  videoId,
  videoTitle,
  speeches,
  index,
  alternativeIndex,
  alternative,
  round,
  roundTranscript,
}: SpeechRedoDialogProps) {
  const speech = speeches[index]
  const storageKey = speech ? speechRedoStorageKey(videoId, speech.key, alternative.title) : ""
  const minutes = speech ? redoSpeechMinutes(speech, round?.format) : 5
  const recordingName = speech ? speechRedoRecordingName(videoId, speech.key, alternativeIndex) : "watch-redo"
  const recordingLabel = speech ? `${speech.label} redo — ${alternative.title}` : "Speech redo"

  const [html, setHtml] = useState<string | null>(null)
  /** Bumped on each fresh speech so the editor reloads instead of keeping the old one. */
  const [version, setVersion] = useState(0)
  const [status, setStatus] = useState<Status>({ state: "idle" })
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const timerSpeeches = useMemo(
    () => [{ name: recordingName, time: minutes, secondary: speech?.side === "neg" }],
    [recordingName, minutes, speech?.side],
  )
  const [time, setTime] = useState(minutes * 60_000)
  const [timerState, setTimerState] = useState<SpeechTimerState["state"]>({ name: "paused" })
  const [recordingEnabled, setRecordingEnabled] = useState(true)
  const [micDeviceId, setMicDeviceId] = useState<string | undefined>(undefined)

  const generate = useCallback(async () => {
    if (!speech) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus({ state: "loading" })
    try {
      const markdown = await requestSpeechRedo(
        { videoTitle, round, speeches, index, alternative, roundTranscript },
        { signal: controller.signal },
      )
      if (controller.signal.aborted) return
      const next = speechRedoToHtml(markdown)
      writeStoredRedo(storageKey, next)
      setHtml(next)
      setVersion((v) => v + 1)
      setStatus({ state: "idle" })
    } catch (error) {
      if (controller.signal.aborted) return
      setStatus({ state: "error", message: error instanceof Error ? error.message : String(error) })
    }
  }, [speech, videoTitle, round, speeches, index, alternative, roundTranscript, storageKey])

  // Opening shows the kept redo, or writes one. Closing abandons a run in
  // flight and stops the clock (which also stops a recording).
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort()
      abortRef.current = null
      setTimerState((state) => (state.name === "running" ? { name: "paused" } : state))
      return
    }
    const stored = readStoredRedo(storageKey)
    if (stored) {
      setHtml(stored.html)
      setStatus({ state: "idle" })
    } else {
      setHtml(null)
      void generate()
    }
    // Only on open or a different alternative — `generate` changes with every render of the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, storageKey])

  useEffect(() => {
    setTime(minutes * 60_000)
    setTimerState({ name: "paused" })
  }, [minutes, recordingName])

  useEffect(() => () => abortRef.current?.abort(), [])

  const onEdit = useCallback(
    (next: string) => {
      setHtml(next)
      writeStoredRedo(storageKey, next)
    },
    [storageKey],
  )

  const copy = async () => {
    if (!html) return
    try {
      await navigator.clipboard.writeText(htmlToText(html))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked.
    }
  }

  if (!speech) return null
  const loading = status.state === "loading"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92vh,60rem)] w-[min(96vw,72rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-3 pr-10">
          <DialogTitle className="text-base">
            Full {speech.label}: {alternative.title}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Claude's full speech in this direction, written from the prior speech and the {speech.label} as given.
            Edit it, then start the timer to record yourself delivering it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-2">
          <SpeechTimer
            speeches={timerSpeeches}
            resetTimeIndex={0}
            time={time}
            state={timerState}
            onResetTimeIndexChange={() => {}}
            onTimeChange={setTime}
            onStateChange={setTimerState}
            speechLabel={recordingLabel}
            micDeviceId={micDeviceId}
            onMicDeviceIdChange={setMicDeviceId}
            recordingEnabled={recordingEnabled}
            onRecordingEnabledChange={setRecordingEnabled}
            compact
          />
          <p className="min-w-[10rem] flex-1 text-[11px] text-muted-foreground">
            {minutes} min speech. {recordingEnabled ? "Starting the timer records your mic." : "Mic is off — the timer runs without recording."}
          </p>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={copy}
              disabled={!html}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-accent disabled:opacity-60 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => void generate()}
              disabled={loading}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} />
              {loading ? "Writing…" : "Write again"}
            </button>
          </div>
          <div className="w-full min-w-0 empty:hidden">
            <SpeechRecordingPlayer
              speechName={recordingName}
              speechLabel={recordingLabel}
              className="w-full"
              micDeviceId={micDeviceId}
              onMicDeviceChange={setMicDeviceId}
              recordingEnabled={recordingEnabled}
              onRecordingEnabledChange={setRecordingEnabled}
              onResetSpeechTime={() => {
                setTime(minutes * 60_000)
                setTimerState({ name: "paused" })
              }}
            />
          </div>
        </div>

        <div className="relative min-h-0 flex-1" aria-busy={loading}>
          {status.state === "error" && (
            <p
              role="alert"
              className="m-3 flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {status.message}
            </p>
          )}
          {html === null ? (
            loading && (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                Writing the full {speech.label}…
              </div>
            )
          ) : (
            <div className={`h-full ${loading ? "opacity-50" : ""}`}>
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
                    <span className="sr-only">Loading editor…</span>
                  </div>
                }
              >
                <SpeechRedoEditor
                  content={html}
                  contentKey={`${storageKey}#${version}`}
                  title={`${speech.label} redo — ${alternative.title}`}
                  onChange={onEdit}
                  showToolbar
                  defaultNavPaneHidden
                  className="h-full"
                />
              </Suspense>
            </div>
          )}
        </div>

        <p className="flex shrink-0 items-start gap-1 border-t border-border px-4 py-1.5 text-[10px] text-muted-foreground">
          <Sparkles className="mt-px h-3 w-3 shrink-0" />
          <span>
            Written by Claude from a rough transcript; bracketed placeholders mark evidence you still need to cut. Your
            edits and recording stay in this browser.
          </span>
        </p>
      </DialogContent>
    </Dialog>
  )
}
