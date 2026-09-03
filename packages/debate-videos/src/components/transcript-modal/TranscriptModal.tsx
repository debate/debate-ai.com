/**
 * @fileoverview Modal overlaying a YouTube player alongside its transcript
 * (fetched server-side via `extract-youtube`), with the transcript synced to
 * playback — the currently spoken line is highlighted and auto-scrolled, an
 * approximate per-word highlight sweeps across the active line, and clicking
 * any line seeks the player there.
 */

"use client"

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react"
import grab from "grab-url"
import { Captions, Loader2, AlertCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../ui/primitives/dialog"
import { ScrollArea } from "../../ui/primitives/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/primitives/tooltip"
import { cn } from "../../ui/lib/utils"

interface TranscriptSnippet {
  text: string
  start: number
  duration: number
}

interface TranscriptModalProps {
  videoId: string
  title: string
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = h > 0 ? m.toString().padStart(2, "0") : m.toString()
  const ss = s.toString().padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

const TranscriptLine = forwardRef<
  HTMLButtonElement,
  {
    snippet: TranscriptSnippet
    isActive: boolean
    currentTime: number
    onSeek: () => void
  }
>(function TranscriptLine({ snippet, isActive, currentTime, onSeek }, ref) {
  const words = useMemo(() => snippet.text.split(/\s+/).filter(Boolean), [snippet.text])

  // Words don't carry their own timestamps — approximate a karaoke-style
  // sweep by spreading the snippet's duration evenly across its words.
  const activeWordIndex =
    isActive && snippet.duration > 0
      ? Math.min(
          words.length - 1,
          Math.max(0, Math.floor(((currentTime - snippet.start) / snippet.duration) * words.length)),
        )
      : -1

  return (
    <button
      ref={ref}
      onClick={(e) => {
        e.stopPropagation()
        onSeek()
      }}
      className={cn(
        "w-full text-left rounded px-2 py-1.5 text-sm transition-colors flex gap-2",
        isActive ? "bg-primary/10" : "hover:bg-accent/60",
      )}
    >
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground pt-0.5">
        {formatTime(snippet.start)}
      </span>
      <span className="text-foreground">
        {words.map((word, i) => (
          <span
            key={i}
            className={cn(i === activeWordIndex && "bg-primary/30 rounded px-0.5 font-medium text-primary")}
          >
            {word}{" "}
          </span>
        ))}
      </span>
    </button>
  )
})

export function TranscriptModal({ videoId, title }: TranscriptModalProps) {
  const [open, setOpen] = useState(false)
  const [snippets, setSnippets] = useState<TranscriptSnippet[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)

  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([])

  // Fetch the transcript whenever the modal is opened.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setSnippets(null)
    setCurrentTime(0)

    grab<{ videoId: string; snippets: TranscriptSnippet[]; error?: string }, { videoId: string }>(
      "transcript",
      { videoId },
    )
      .then((data) => {
        if (cancelled) return
        // grab resolves with an `error` field rather than throwing on a
        // non-2xx response, so a failure has to be checked for here.
        if (!data || data.error) {
          setError(data?.error || "Failed to load transcript")
          return
        }
        setSnippets(data.snippets ?? [])
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load transcript")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, videoId])

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
              src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0`}
              title={title}
              onLoad={handleIframeLoad}
              className="absolute inset-0 w-full h-full"
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
