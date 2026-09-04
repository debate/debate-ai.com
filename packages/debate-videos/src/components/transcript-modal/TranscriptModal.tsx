/**
 * @fileoverview Modal overlaying a YouTube player alongside its transcript
 * (fetched server-side from YouTube's caption tracks), with the transcript synced to
 * playback — the currently spoken line is highlighted and auto-scrolled, an
 * approximate per-word highlight sweeps across the active line, and clicking
 * any line seeks the player there.
 */

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Captions, Loader2, AlertCircle } from "lucide-react"
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
import { TranscriptLine } from "./TranscriptLine"

interface TranscriptModalProps {
  videoId: string
  title: string
}

export function TranscriptModal({ videoId, title }: TranscriptModalProps) {
  const [open, setOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const { snippets, loading, error } = useTranscript(videoId, open)

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

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] flex-1 min-h-0">
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
                {error && !loading && (
                  <div className="flex items-start gap-2 text-sm text-destructive p-3">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
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
                    onSeek={() => seekTo(snippet.start)}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
