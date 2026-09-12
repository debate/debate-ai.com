/**
 * @fileoverview The transcript column beside the video on the watch page.
 *
 * The same synced, clickable sentences the transcript modal and the popout
 * player's caption tray show — {@link TranscriptLine} is shared — given room
 * to be read: a full-height column that follows playback and can be searched.
 *
 * A video whose captions can't be read renders nothing here and the page
 * simply widens; that is not an error worth showing, because most of the
 * library has no captions at all.
 * @module components/watch/WatchTranscriptPanel
 */

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Search, X } from "lucide-react"
import { ScrollArea } from "../../ui/primitives/scroll-area"
import { TranscriptLine } from "../transcript/TranscriptLine"
import type { TranscriptSnippet } from "../transcript/transcriptUtils"

interface WatchTranscriptPanelProps {
  /** The video's transcript, already regrouped into sentences. */
  sentences: TranscriptSnippet[]
  loading: boolean
  currentTime: number
  onSeek: (seconds: number) => void
}

/** Formats seconds as `m:ss`, or `h:mm:ss` past an hour. */
function timecode(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  const h = Math.floor(whole / 3600)
  const m = Math.floor((whole % 3600) / 60)
  const s = whole % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`
}

export function WatchTranscriptPanel({
  sentences,
  loading,
  currentTime,
  onSeek,
}: WatchTranscriptPanelProps) {
  const [query, setQuery] = useState("")
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([])

  const needle = query.trim().toLowerCase()
  const visible = useMemo(
    () =>
      sentences
        .map((snippet, index) => ({ snippet, index }))
        .filter(({ snippet }) => !needle || snippet.text.toLowerCase().includes(needle)),
    [sentences, needle],
  )

  const activeIndex = useMemo(() => {
    let idx = -1
    for (let i = 0; i < sentences.length; i++) {
      if (sentences[i].start <= currentTime) idx = i
      else break
    }
    return idx
  }, [sentences, currentTime])

  // Follow playback, but not while the reader is searching: scrolling the
  // list out from under someone reading their own results is worse than
  // losing the follow.
  useEffect(() => {
    if (activeIndex < 0 || needle) return
    lineRefs.current[activeIndex]?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [activeIndex, needle])

  return (
    <aside className="flex flex-col min-h-0 rounded-lg border border-border bg-card/40 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Transcript
        </h2>
        {sentences.length > 0 && (
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {needle ? `${visible.length}/${sentences.length}` : timecode(currentTime)}
          </span>
        )}
      </div>

      {sentences.length > 0 && (
        <div className="relative px-2 py-2 border-b border-border shrink-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the transcript"
            aria-label="Search the transcript"
            className="w-full rounded-md border border-border bg-background pl-8 pr-7 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear transcript search"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0 h-[320px] lg:h-auto">
        <div className="p-2 space-y-0.5">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading transcript...
            </div>
          )}

          {!loading && needle && visible.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">No line matches “{query.trim()}”.</p>
          )}

          {visible.map(({ snippet, index }) => (
            <div key={index} className="flex items-start gap-1.5">
              <button
                onClick={() => onSeek(snippet.start)}
                aria-label={`Seek to ${timecode(snippet.start)}`}
                className="mt-1 shrink-0 text-[10px] tabular-nums text-muted-foreground hover:text-primary transition-colors"
              >
                {timecode(snippet.start)}
              </button>
              <TranscriptLine
                ref={(el) => {
                  lineRefs.current[index] = el
                }}
                snippet={snippet}
                isActive={index === activeIndex}
                currentTime={currentTime}
                onSeek={() => onSeek(snippet.start)}
              />
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  )
}
