/**
 * @fileoverview A small live-caption box above the watch page's speech tabs,
 * about four lines tall: the caption sentence being spoken now (bold, at the
 * bottom) under the few lines before it, following playback.
 *
 * The full Live captions view lists every line; this is the glanceable
 * version that stays on whichever speech tab is open. A toggle collapses it
 * to a slim "Captions" button, and the choice is remembered
 * (`lib/watch-preferences`, `liveCaption`; synced to the account when signed in).
 * @module components/watch/LiveCaptionLine
 */

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Captions, ChevronUp } from "lucide-react"
import type { TranscriptSnippet } from "../transcript/transcriptUtils"
import { readWatchPreference, writeWatchPreference } from "../../../lib/watch-preferences"

/**
 * The caption line playing at `seconds`: the last one that has started. A gap
 * after a line ends keeps showing it until the next begins, so the line
 * doesn't blink empty between sentences.
 *
 * @returns The line's index, or -1 before the first one starts.
 */
export function liveCaptionIndex(sentences: TranscriptSnippet[], seconds: number): number {
  let low = 0
  let high = sentences.length - 1
  let found = -1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (sentences[mid].start <= seconds) {
      found = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return found
}

/** How many lines before the current one stay visible above it. */
const EARLIER_LINES = 3

interface LiveCaptionLineProps {
  sentences: TranscriptSnippet[]
  loading?: boolean
  currentTime: number
}

export function LiveCaptionLine({ sentences, loading = false, currentTime }: LiveCaptionLineProps) {
  // Starts shown, then picks up the stored choice after mount so the server
  // render and the first client render agree.
  const [shown, setShownState] = useState(true)
  useEffect(() => {
    setShownState(readWatchPreference("liveCaption"))
  }, [])
  const setShown = useCallback((value: boolean) => {
    setShownState(value)
    writeWatchPreference("liveCaption", value)
  }, [])

  const index = useMemo(() => liveCaptionIndex(sentences, currentTime), [sentences, currentTime])
  const line = index >= 0 ? sentences[index].text : ""
  // The lines just before it, so the box reads as a few lines of running text.
  const earlier = index > 0 ? sentences.slice(Math.max(0, index - EARLIER_LINES), index) : []

  if (!shown) {
    return (
      <div className="flex shrink-0 justify-end border-b border-border px-2 py-0.5">
        <button
          type="button"
          onClick={() => setShown(true)}
          aria-expanded={false}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Show the live caption line"
        >
          <Captions className="h-3.5 w-3.5" />
          Show live captions
        </button>
      </div>
    )
  }

  return (
    <div className="flex shrink-0 items-start gap-2 border-b border-border bg-background px-3 py-1.5">
      <Captions className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      {/* About four lines tall, newest at the bottom: older text scrolls off the top. */}
      <div className="flex h-[5.25rem] min-w-0 flex-1 flex-col justify-end overflow-hidden text-sm leading-[1.3rem]">
        {earlier.length > 0 && (
          <p className="text-muted-foreground">
            {earlier.map((sentence) => sentence.text).join(" ")}
          </p>
        )}
        <p aria-live="polite" aria-label="Live caption" className="font-medium text-foreground">
          {line || (
            <span className="font-normal text-muted-foreground italic">
              {loading ? "Loading captions…" : "Captions start when the speaking does."}
            </span>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setShown(false)}
        aria-expanded
        className="inline-flex shrink-0 items-center rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        aria-label="Hide live captions"
        title="Hide the live caption line"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
