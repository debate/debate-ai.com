/**
 * @fileoverview The round, one tab per speech — the watch page's "By speech"
 * view. Every round gets it: from its AI summary or written analysis when it
 * has one, otherwise from its transcript or its format's standard speech
 * order (see `lib/round-formats.ts`).
 *
 * The document tabs beside it show one document at a time, top to bottom,
 * which is right for reading the whole summary and wrong for following the
 * round: at the 1AR you want the 1AR's summary, its analysis and its words,
 * and nothing else. So this panel turns the round sideways. Each speech (see
 * {@link buildRoundSpeeches}) is a tab, coloured by side, and inside it the
 * summary, analysis and transcript are views of that one speech.
 *
 *   - The speech playing now is marked with a pulsing dot, and — while the
 *     shared auto-scroll choice is on — the panel moves to it when it begins.
 *     Only on a change of speech, so a reader browsing ahead is left alone
 *     until the next one starts.
 *   - Clicking a timed speech's tab also seeks the video to it, as the
 *     timeline under the player does. Arrow keys move between tabs without
 *     seeking, so stepping through them does not jump the video around.
 *   - The chosen view (Summary / Analysis / Transcript / Outcomes) sticks
 *     across speeches, falling back to the first one a speech actually has.
 *   - **Outcomes** (see {@link WatchSpeechOutcomes}) is offered on every
 *     speech, written or not: alternative responses the speaker could have
 *     given, with a judge panel's predicted ballots after each. A speech
 *     with a run saved in this browser gets a sparkle on its tab.
 *   - **Mark start** sets the speech's start to the current video time, for
 *     rounds whose documents don't time their speeches (see
 *     `state/speechStartMarks.ts`). A marked start can be cleared again.
 * @module components/watch/WatchRoundPanel
 */

"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { Bot, Flag, Play, Sparkles, X } from "lucide-react"
import { ScrollArea } from "../../ui/primitives/scroll-area"
import { playingSpeechIndex, type RoundSpeech } from "../../lib/round-speeches"
import { formatTimecode, type VideoDocument, type VideoDocumentKind } from "../../lib/video-documents"
import { renderDocumentMarkdown } from "../../lib/document-markdown"
import { AutoScrollToggle } from "./AutoScrollToggle"
import { MARKDOWN_CLASSES } from "./WatchDocumentPanel"
import { SPEECH_SIDE_STYLES } from "./speech-side-styles"
import { WatchSpeechOutcomes } from "./WatchSpeechOutcomes"
import type { RoundContext } from "../../lib/speech-outcomes"
import { cachedSpeechKeys } from "../../state/speechOutcomeCache"

/** A document view, or the AI alternative-responses view. */
type SpeechView = VideoDocumentKind | "outcomes"

/** The views inside a speech, in the order they are offered. */
const VIEWS: Array<{ kind: SpeechView; label: string }> = [
  { kind: "summary", label: "Summary" },
  { kind: "analysis", label: "Analysis" },
  { kind: "transcript", label: "Transcript" },
  { kind: "outcomes", label: "Outcomes" },
]

/** A request from outside the panel — the timeline — to show a speech. */
export interface SpeechFocusRequest {
  key: string
  /** Bumped on every request, so asking for the same speech twice still lands. */
  seq: number
}

interface WatchRoundPanelProps {
  speeches: RoundSpeech[]
  /** The video's documents, for the AI attribution line. */
  documents?: VideoDocument[]
  currentTime?: number
  onSeek?: (seconds: number) => void
  autoScroll?: boolean
  onAutoScrollChange?: (value: boolean) => void
  focusRequest?: SpeechFocusRequest | null
  /** The video, for the Outcomes view; without it the view is not offered. */
  videoId?: string
  videoTitle?: string
  /** What the video's metadata says about the round, for the Outcomes prompt. */
  round?: RoundContext
  /** The whole round's captions, for Outcomes on a speech with nothing of its own. */
  roundTranscript?: string
  /**
   * Sets (or, with `null`, clears) a speech's start. Without it the panel
   * offers no Mark start control.
   */
  onMarkStart?: (speechKey: string, seconds: number | null) => void
  /** Speeches whose start the reader marked, and so can clear. */
  markedKeys?: ReadonlySet<string>
}

const NO_KEYS: ReadonlySet<string> = new Set()

export function WatchRoundPanel({
  speeches,
  documents = [],
  currentTime = 0,
  onSeek,
  autoScroll = true,
  onAutoScrollChange,
  focusRequest,
  videoId,
  videoTitle,
  round,
  roundTranscript,
  onMarkStart,
  markedKeys = NO_KEYS,
}: WatchRoundPanelProps) {
  const [activeKey, setActiveKey] = useState(speeches[0]?.key ?? "")
  const [view, setView] = useState<SpeechView>("summary")
  const [simulated, setSimulated] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    setSimulated(videoId ? cachedSpeechKeys(videoId) : new Set())
  }, [videoId])
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const stripRef = useRef<HTMLDivElement | null>(null)

  const playingIndex = useMemo(() => playingSpeechIndex(speeches, currentTime), [speeches, currentTime])
  const isTimed = useMemo(() => speeches.some((speech) => speech.startSeconds !== null), [speeches])

  // A different video brings a different round.
  useEffect(() => {
    setActiveKey((current) =>
      speeches.some((speech) => speech.key === current) ? current : (speeches[0]?.key ?? ""),
    )
  }, [speeches])

  useEffect(() => {
    if (!autoScroll || playingIndex < 0) return
    setActiveKey(speeches[playingIndex].key)
  }, [autoScroll, playingIndex, speeches])

  useEffect(() => {
    if (focusRequest && speeches.some((speech) => speech.key === focusRequest.key)) {
      setActiveKey(focusRequest.key)
    }
  }, [focusRequest, speeches])

  // Keep the active tab in view along the strip. Set by hand rather than with
  // scrollIntoView, which would also scroll the page to the panel.
  useEffect(() => {
    const strip = stripRef.current
    const tab = tabRefs.current[activeKey]
    if (!strip || !tab) return
    const left = tab.offsetLeft
    const right = left + tab.offsetWidth
    if (left < strip.scrollLeft) strip.scrollLeft = left - 8
    else if (right > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = right - strip.clientWidth + 8
  }, [activeKey])

  const activeIndex = Math.max(
    0,
    speeches.findIndex((speech) => speech.key === activeKey),
  )
  const active = speeches[activeIndex]
  const views = VIEWS.filter(({ kind }) =>
    kind === "outcomes" ? Boolean(videoId && active?.isSpeech) : active?.parts[kind],
  )
  // A speech with nothing written still has Outcomes, but a reader who asked
  // for the summary should land on words where there are any.
  const shownView = views.some(({ kind }) => kind === view) ? view : views[0]?.kind
  const body = shownView && shownView !== "outcomes" ? active?.parts[shownView] : undefined
  const html = useMemo(() => (body ? renderDocumentMarkdown(body) : ""), [body])
  const source = documents.find((document) => document.kind === shownView)

  if (!active) return null

  const selectSpeech = (index: number, seek: boolean) => {
    const speech = speeches[index]
    setActiveKey(speech.key)
    if (seek && onSeek && speech.startSeconds !== null) onSeek(speech.startSeconds)
  }

  const handleStripKeyDown = (event: KeyboardEvent) => {
    let next: number | null = null
    if (event.key === "ArrowRight") next = (activeIndex + 1) % speeches.length
    if (event.key === "ArrowLeft") next = (activeIndex - 1 + speeches.length) % speeches.length
    if (event.key === "Home") next = 0
    if (event.key === "End") next = speeches.length - 1
    if (next === null) return
    event.preventDefault()
    selectSpeech(next, false)
    tabRefs.current[speeches[next].key]?.focus()
  }

  const side = SPEECH_SIDE_STYLES[active.side]

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div
        ref={stripRef}
        role="tablist"
        aria-label="Speeches"
        onKeyDown={handleStripKeyDown}
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-muted/30 p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {speeches.map((speech, index) => {
          const isActive = index === activeIndex
          const isPlaying = index === playingIndex
          return (
            <button
              key={speech.key}
              ref={(el) => {
                tabRefs.current[speech.key] = el
              }}
              id={`speech-tab-${index}`}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls="speech-panel"
              tabIndex={isActive ? 0 : -1}
              title={speech.startSeconds !== null ? `${speech.heading} · ${formatTimecode(speech.startSeconds)}` : speech.heading}
              onClick={() => selectSpeech(index, true)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "border-border bg-background text-foreground shadow-sm"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${SPEECH_SIDE_STYLES[speech.side].dot}`} aria-hidden />
              {speech.label}
              {simulated.has(speech.key) && (
                <Sparkles className="h-2.5 w-2.5 text-primary" aria-label="has simulated outcomes" />
              )}
              {isPlaying && (
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse motion-reduce:animate-none">
                  <span className="sr-only">(playing)</span>
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div
        id="speech-panel"
        role="tabpanel"
        aria-labelledby={`speech-tab-${activeIndex}`}
        className="flex flex-col min-h-0 flex-1"
      >
        <div className="shrink-0 space-y-2 border-b border-border px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-snug">{active.heading}</h3>
              <p className="text-[11px] text-muted-foreground">{side.name}</p>
              {onMarkStart && !isTimed && (
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Play to where each speech begins and press Mark start — the timeline, the playing marker and each
                  speech&apos;s captions follow.
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {isTimed && onAutoScrollChange && (
                <AutoScrollToggle checked={autoScroll} onChange={onAutoScrollChange} />
              )}
              {active.startSeconds !== null && onSeek && (
                <button
                  type="button"
                  onClick={() => onSeek(active.startSeconds as number)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] tabular-nums hover:bg-accent transition-colors"
                  aria-label={`Play ${active.label} from ${formatTimecode(active.startSeconds)}`}
                >
                  <Play className="h-3 w-3" />
                  {formatTimecode(active.startSeconds)}
                </button>
              )}
              {onMarkStart && markedKeys.has(active.key) && (
                <button
                  type="button"
                  onClick={() => onMarkStart(active.key, null)}
                  className="inline-flex items-center rounded-md border border-border p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  aria-label={`Clear ${active.label}'s start`}
                  title="Clear this start"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              {onMarkStart && (
                <button
                  type="button"
                  onClick={() => onMarkStart(active.key, currentTime)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] hover:bg-accent transition-colors"
                  title={`Set ${active.label}'s start to the video's current time (${formatTimecode(currentTime)})`}
                >
                  <Flag className="h-3 w-3" />
                  Mark start
                </button>
              )}
            </div>
          </div>

          {views.length > 1 && (
            <div role="tablist" aria-label={`${active.label} views`} className="inline-flex rounded-md bg-muted p-0.5">
              {views.map(({ kind, label }) => (
                <button
                  key={kind}
                  role="tab"
                  type="button"
                  aria-selected={kind === shownView}
                  onClick={() => setView(kind)}
                  className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    kind === shownView
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {shownView === "outcomes" && videoId ? (
          <WatchSpeechOutcomes
            videoId={videoId}
            videoTitle={videoTitle}
            speeches={speeches}
            index={activeIndex}
            round={round}
            roundTranscript={roundTranscript}
            onSimulated={(key) => setSimulated((current) => new Set(current).add(key))}
          />
        ) : (
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3">
            {html ? (
              <div
                className={MARKDOWN_CLASSES}
                // Sanitized by renderDocumentMarkdown: raw HTML is escaped
                // and only http(s)/mailto URLs survive.
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <p className="text-xs italic text-muted-foreground">
                Nothing written for this speech yet
                {onMarkStart && active.startSeconds === null ? " — mark where it starts and its captions show here" : ""}.
              </p>
            )}
          </div>
        </ScrollArea>
        )}

        {shownView !== "outcomes" && source?.author === "ai" && (
          <p className="flex items-center gap-1 border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground shrink-0">
            <Bot className="h-3 w-3 shrink-0" />
            Generated{source.model ? ` by ${source.model}` : ""} — check it against the video before relying on it.
          </p>
        )}
      </div>
    </div>
  )
}
