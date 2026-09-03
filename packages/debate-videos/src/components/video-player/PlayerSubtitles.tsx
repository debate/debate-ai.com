/**
 * @fileoverview Scrollable, playback-synced subtitles panel shown above the
 * popout player's video when captions are toggled on. Reuses the same
 * transcript fetch/line rendering as the transcript modal; clicking a word
 * or line seeks the player to that position.
 */

"use client"

import { useEffect, useMemo, useRef } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { useTranscript } from "../transcript-modal/useTranscript"
import { TranscriptLine } from "../transcript-modal/TranscriptLine"

interface PlayerSubtitlesProps {
  videoId: string
  currentTime: number
  onSeek: (seconds: number) => void
}

export function PlayerSubtitles({ videoId, currentTime, onSeek }: PlayerSubtitlesProps) {
  const { snippets, loading, error } = useTranscript(videoId, true)
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([])

  const activeIndex = useMemo(() => {
    if (!snippets || snippets.length === 0) return -1
    let idx = -1
    for (let i = 0; i < snippets.length; i++) {
      if (snippets[i].start <= currentTime) idx = i
      else break
    }
    return idx
  }, [snippets, currentTime])

  // Keep the active line in view as playback advances.
  useEffect(() => {
    if (activeIndex < 0) return
    lineRefs.current[activeIndex]?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [activeIndex])

  return (
    <div className="max-h-48 overflow-y-auto border-b border-border bg-background">
      <div className="p-1.5 space-y-0.5">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading captions...
          </div>
        )}
        {error && !loading && (
          <div className="flex items-start gap-2 text-xs text-destructive p-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {snippets?.map((snippet, index) => (
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
