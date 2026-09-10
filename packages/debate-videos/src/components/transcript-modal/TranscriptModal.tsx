/**
 * @fileoverview Modal overlaying a YouTube player alongside its transcript
 * (fetched server-side from YouTube's caption tracks), with the transcript
 * synced to playback — caption cues are regrouped into whole sentences and
 * read as prose, the currently spoken sentence is highlighted and
 * auto-scrolled, an approximate per-word highlight sweeps across it, and
 * clicking a sentence seeks the player to where it starts.
 *
 * A video whose captions can't be read shows no transcript rather than an
 * error: the modal is then just the player.
 */

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Captions, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../ui/primitives/dialog"
import { ScrollArea } from "../../ui/primitives/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/primitives/tooltip"
import { buildEmbedUrl } from "../video-player/youtubeEmbed"
import { useTranscript } from "./useTranscript"
import { groupIntoSentences } from "./transcriptUtils"
import { TranscriptLine } from "./TranscriptLine"

interface TranscriptModalProps {
  videoId: string
  title: string
}

export function TranscriptModal({ videoId, title }: TranscriptModalProps) {
  const [open, setOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const { snippets: cues, loading } = useTranscript(videoId, open)

  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([])

  // Reset playback tracking whenever the modal is (re)opened.
  useEffect(() => {
    if (open) setCurrentTime(0)
  }, [open])

  // Listen for the YouTube embed's periodic playback-time broadcasts.
  useEffect(() => {
    if (!open) return
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube.com") return
      try {
        const data = JSON.parse(event.data)
        if (data.event === "infoDelivery" && data.info?.currentTime != null) {
          setCurrentTime(data.info.currentTime)
        }
      } catch {
        // ignore non-JSON messages
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [open])

  // Handshake the embed into broadcasting `infoDelivery` messages once loaded.
  const handleIframeLoad = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "listening", id: videoId, channel: "widget" }),
      "https://www.youtube.com",
    )
  }, [videoId])

  const seekTo = useCallback((seconds: number) => {
    const contentWindow = iframeRef.current?.contentWindow
    if (!contentWindow) return
    contentWindow.postMessage(
      JSON.stringify({ event: "command", func: "seekTo", args: [seconds, true] }),
      "https://www.youtube.com",
    )
    contentWindow.postMessage(
      JSON.stringify({ event: "command", func: "playVideo", args: [] }),
      "https://www.youtube.com",
    )
  }, [])

  // Cues are cut for on-screen display and break mid-clause; read as prose
  // instead by regrouping them into sentences.
  const snippets = useMemo(() => (cues ? groupIntoSentences(cues) : null), [cues])

  // No captions (or a failed fetch) collapses the sidebar instead of showing
  // an error.
  const hasTranscript = loading || (snippets?.length ?? 0) > 0

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
    lineRefs.current[activeIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [activeIndex])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setOpen(true)
            }}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
            aria-label="View transcript"
          >
            <Captions className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Transcript</TooltipContent>
      </Tooltip>

      <DialogContent
        className="max-w-5xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader className="p-4 pb-2 border-b border-border shrink-0">
          <DialogTitle className="truncate pr-6">{title}</DialogTitle>
        </DialogHeader>

        <div
          className={`grid grid-cols-1 flex-1 min-h-0 ${hasTranscript ? "lg:grid-cols-[1fr_360px]" : ""}`}
        >
          <div className="relative w-full bg-black" style={{ paddingTop: "56.25%" }}>
            <iframe
              ref={iframeRef}
              src={buildEmbedUrl(videoId)}
              title={title}
              onLoad={handleIframeLoad}
              className="absolute inset-0 w-full h-full"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          {hasTranscript && (
            <div className="flex flex-col min-h-0 border-t lg:border-t-0 lg:border-l border-border">
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border shrink-0">
                Transcript
              </div>
              <ScrollArea className="flex-1 min-h-0 h-[280px] lg:h-auto">
                <div className="p-2 space-y-0.5">
                  {loading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground p-3">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading transcript...
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
                      onSeek={() => seekTo(snippet.start)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
