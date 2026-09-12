/**
 * @fileoverview Scrollable, playback-synced subtitles panel shown above the
 * popout player's video when captions are toggled on. Sentences are shown as
 * prose (no timestamps); clicking one seeks the player to where it starts.
 *
 * The transcript is loaded by the player, which only offers the captions
 * control for videos that turned out to have one — so this panel has no
 * loading or error state of its own: given nothing to show, it renders
 * nothing.
 */

"use client"

import { useEffect, useMemo, useRef } from "react"
import { TranscriptLine } from "../transcript/TranscriptLine"
import type { TranscriptSnippet } from "../transcript/transcriptUtils"

interface PlayerSubtitlesProps {
  /** The video's transcript, already regrouped into sentences. */
  sentences: TranscriptSnippet[]
  currentTime: number
  onSeek: (seconds: number) => void
}

export function PlayerSubtitles({ sentences, currentTime, onSeek }: PlayerSubtitlesProps) {
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([])

  const activeIndex = useMemo(() => {
    let idx = -1
    for (let i = 0; i < sentences.length; i++) {
      if (sentences[i].start <= currentTime) idx = i
      else break
    }
    return idx
  }, [sentences, currentTime])

  // Keep the active line in view as playback advances.
  useEffect(() => {
    if (activeIndex < 0) return
    lineRefs.current[activeIndex]?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [activeIndex])

  if (sentences.length === 0) return null

  return (
    <div className="max-h-48 overflow-y-auto border-b border-border bg-background">
      <div className="p-1.5 space-y-0.5">
        {sentences.map((snippet, index) => (
          <TranscriptLine
            key={index}
            ref={(el) => {
              lineRefs.current[index] = el
            }}
            snippet={snippet}
            isActive={index === activeIndex}
            currentTime={currentTime}
            onSeek={() => onSeek(snippet.start)}
            compact
          />
        ))}
      </div>
    </div>
  )
}
