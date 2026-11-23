/**
 * @fileoverview The **LLM summary** of a lecture (any video that isn't a
 * round): one outline of the whole caption track, the first tab beside the
 * player.
 *
 *   - Opening the tab shows the outline any viewer already wrote for the
 *     video (the shared store, `state/sharedVideoAi.ts`, saved in the
 *     database), or this browser's own.
 *   - When there is none yet, the first viewer to open it starts writing one
 *     as soon as the captions are in, and it is offered back to the shared
 *     store, so every later viewer gets it without asking the AI again.
 *   - **Run again** rewrites it and replaces the shared copy.
 * @module components/watch/WatchLectureSummary
 */

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Bot, Loader2, RotateCcw, Sparkles } from "lucide-react"
import { ScrollArea } from "../../../ui/primitives/scroll-area"
import { renderDocumentMarkdown } from "../../../lib/document-markdown"
import { captionText } from "../../../lib/round-speeches"
import { LECTURE_SUMMARY_SPEECH } from "../../../lib/speech-summary"
import { requestLectureSummary } from "../../../lib/speech-ai-client"
import { readSpeechSummaries, writeSpeechSummary } from "../../../state/speechAiCache"
import { loadSharedVideoAi, shareVideoAiResult, useSharedVideoAi } from "../../../state/sharedVideoAi"
import type { TranscriptSnippet } from "../transcript/transcriptUtils"
import { LARGE_MARKDOWN_CLASSES } from "./WatchDocumentPanel"

interface WatchLectureSummaryProps {
  videoId: string
  videoTitle?: string
  /** The video's captions, the outline's source. */
  sentences: TranscriptSnippet[]
  captionsLoading: boolean
}

export function WatchLectureSummary({ videoId, videoTitle, sentences, captionsLoading }: WatchLectureSummaryProps) {
  const shared = useSharedVideoAi(videoId)
  const [own, setOwn] = useState<string | null>(null)
  const [writing, setWriting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** The video this mount already decided about, so a first open writes at most once. */
  const decided = useRef<string | null>(null)
  const current = useRef(videoId)

  useEffect(() => {
    current.current = videoId
    setOwn(readSpeechSummaries(videoId)[LECTURE_SUMMARY_SPEECH] ?? null)
    setWriting(false)
    setError(null)
  }, [videoId])

  const transcript = useMemo(() => captionText(sentences), [sentences])
  const outline = own ?? shared.summaries[LECTURE_SUMMARY_SPEECH] ?? null

  const write = async (replace: boolean) => {
    const forVideo = videoId
    const text = transcript.trim()
    if (!text) return
    setWriting(true)
    setError(null)
    try {
      const result = await requestLectureSummary({ transcript: text, videoTitle })
      if (current.current !== forVideo) return
      writeSpeechSummary(forVideo, LECTURE_SUMMARY_SPEECH, result)
      setOwn(result)
      void shareVideoAiResult(forVideo, { kind: "summary", key: LECTURE_SUMMARY_SPEECH, data: result }, { replace })
    } catch (failure) {
      if (current.current !== forVideo) return
      setError(failure instanceof Error ? failure.message : "The summary failed.")
    } finally {
      if (current.current === forVideo) setWriting(false)
    }
  }

  // The first open with captions in hand: wait for the shared copy, and write
  // one only when nobody has.
  useEffect(() => {
    if (captionsLoading || !transcript.trim() || decided.current === videoId) return
    decided.current = videoId
    if (readSpeechSummaries(videoId)[LECTURE_SUMMARY_SPEECH]) return
    let cancelled = false
    let answered = false
    void loadSharedVideoAi(videoId).then((loaded) => {
      if (cancelled) return
      answered = true
      if (current.current !== videoId || loaded.summaries[LECTURE_SUMMARY_SPEECH]) return
      void write(false)
    })
    return () => {
      cancelled = true
      // Gone before the shared copy answered: let the next run decide.
      if (!answered && decided.current === videoId) decided.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, captionsLoading, transcript])

  const html = useMemo(() => (outline ? renderDocumentMarkdown(outline) : ""), [outline])

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3">
          {writing ? (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
              Outlining this video&apos;s key points and warrants…
            </p>
          ) : html ? (
            <div
              className={`${LARGE_MARKDOWN_CLASSES} animate-in fade-in-0 duration-300 motion-reduce:animate-none`}
              // Sanitized by renderDocumentMarkdown: raw HTML is escaped
              // and only http(s)/mailto URLs survive.
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : error ? (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
              <button
                type="button"
                onClick={() => void write(false)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Try again
              </button>
            </div>
          ) : captionsLoading ? (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
              Loading the captions…
            </p>
          ) : transcript.trim() ? (
            <button
              type="button"
              onClick={() => void write(false)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent transition-colors"
            >
              <Sparkles className="h-3 w-3" />
              Write the LLM summary
            </button>
          ) : (
            <p className="text-xs italic text-muted-foreground">No captions to summarize for this video.</p>
          )}
        </div>
      </ScrollArea>

      {outline && !writing && (
        <p className="flex items-center justify-between gap-2 border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground shrink-0">
          <span className="flex items-center gap-1">
            <Bot className="h-3 w-3 shrink-0" />
            AI outline from the captions — check it against the video.
          </span>
          {transcript.trim() && (
            <button
              type="button"
              onClick={() => void write(true)}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              Run again
            </button>
          )}
        </p>
      )}
    </div>
  )
}
