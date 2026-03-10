"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { X, Minus, Maximize2, SkipForward, ListVideo, Play, Pause } from "lucide-react"
import { useVideoPlayerStore, videoPlayerIframeRef, sendYouTubeCommand } from "@/lib/state/videoPlayerStore"

/**
 * A persistent floating video player that keeps the YouTube iframe alive
 * across all page navigation. Rendered via a React portal directly into
 * document.body so it is never affected by parent component re-renders,
 * z-index stacking contexts, or overflow clipping on any page.
 *
 * Supports a play queue — "Add to Queue" from any video card enqueues the
 * video to play after the current one finishes (or when the user presses
 * SkipForward). The play/pause button sends commands to the YouTube iframe
 * via the IFrame API postMessage interface.
 *
 * The title bar is a draggable handle — supports both mouse and touch drag
 * so the popout can be repositioned on desktop and mobile.
 */
function VideoPlayerUI() {
  const {
    activeVideoId,
    activeVideoTitle,
    isMinimized,
    isPlaying,
    queue,
    clearActiveVideo,
    setMinimized,
    setIsPlaying,
    playNextInQueue,
  } = useVideoPlayerStore()

  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  // Track the last videoId we loaded to avoid re-creating the iframe src
  const loadedVideoIdRef = useRef<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Drag state — null means "use default CSS bottom/right positioning"
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const dragOffsetRef = useRef({ x: 0, y: 0 })

  // Register iframe ref globally so other components can send commands
  const setIframeRef = useCallback((el: HTMLIFrameElement | null) => {
    iframeRef.current = el
    videoPlayerIframeRef.current = el
  }, [])

  // Listen for YouTube IFrame API state change events
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube.com") return
      try {
        const data = JSON.parse(event.data)
        // YouTube player state: -1=unstarted, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued
        if (data.event === "onStateChange") {
          if (data.info === 1 || data.info === 3) {
            setIsPlaying(true)
          } else if (data.info === 2 || data.info === 0) {
            setIsPlaying(false)
          }
        }
      } catch {
        // ignore non-JSON messages
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [setIsPlaying])

  const handlePlayPause = useCallback(() => {
    sendYouTubeCommand(isPlaying ? "pauseVideo" : "playVideo")
    setIsPlaying(!isPlaying)
  }, [isPlaying, setIsPlaying])

  // Begin drag — capture pointer offset within the element
  const startDrag = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    dragOffsetRef.current = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
    // Snapshot the current rendered position as absolute coords so the
    // element doesn't jump when we switch from bottom/right to top/left.
    setPosition({ x: rect.left, y: rect.top })
    isDraggingRef.current = true
    setIsDragging(true)
  }, [])

  // Clamp a proposed position so the element stays fully on-screen
  const clampPosition = useCallback((x: number, y: number) => {
    const el = containerRef.current
    if (!el) return { x, y }
    return {
      x: Math.max(0, Math.min(window.innerWidth - el.offsetWidth, x)),
      y: Math.max(0, Math.min(window.innerHeight - el.offsetHeight, y)),
    }
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      setPosition(clampPosition(
        e.clientX - dragOffsetRef.current.x,
        e.clientY - dragOffsetRef.current.y,
      ))
    }
    const handleMouseUp = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      setIsDragging(false)
    }
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return
      const touch = e.touches[0]
      setPosition(clampPosition(
        touch.clientX - dragOffsetRef.current.x,
        touch.clientY - dragOffsetRef.current.y,
      ))
      // Prevent the page from scrolling while dragging the popout
      e.preventDefault()
    }
    const handleTouchEnd = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      setIsDragging(false)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    document.addEventListener("touchmove", handleTouchMove, { passive: false })
    document.addEventListener("touchend", handleTouchEnd)
    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
    }
  }, [clampPosition])

  if (!activeVideoId) return null

  // Build iframe src — only rebuild when videoId changes
  const iframeSrc = `https://www.youtube.com/embed/${activeVideoId}?autoplay=1&enablejsapi=1`

  // When a drag has started we override the default bottom/right CSS classes
  // with explicit top/left inline styles so the element is freely positionable.
  const positionStyle: React.CSSProperties = position
    ? { left: position.x, top: position.y, bottom: "auto", right: "auto" }
    : {}

  return (
    <div
      ref={containerRef}
      className={`fixed bottom-20 right-4 md:bottom-6 z-[9999] shadow-2xl rounded-xl overflow-hidden border border-border bg-background transition-[width,height] duration-300 ${
        isMinimized ? "w-64 h-10" : "w-72 sm:w-80"
      }`}
      style={{ maxWidth: "calc(100vw - 2rem)", ...positionStyle }}
    >
      {/* Title bar — drag handle */}
      <div
        className={`flex items-center justify-between px-3 py-2 bg-muted/80 backdrop-blur-sm gap-2 select-none touch-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        onMouseDown={(e) => {
          // Don't start drag when clicking a button
          if ((e.target as HTMLElement).closest("button")) return
          e.preventDefault()
          startDrag(e.clientX, e.clientY)
        }}
        onTouchStart={(e) => {
          if ((e.target as HTMLElement).closest("button")) return
          startDrag(e.touches[0].clientX, e.touches[0].clientY)
        }}
      >
        <span className="text-xs font-medium text-foreground truncate flex-1 min-w-0">
          {activeVideoTitle ?? "Playing video"}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {/* Play / Pause */}
          <button
            onClick={handlePlayPause}
            className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            aria-label={isPlaying ? "Pause video" : "Play video"}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </button>

          {queue.length > 0 && (
            <button
              onClick={playNextInQueue}
              className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground flex items-center gap-0.5"
              title={`Skip to next (${queue.length} in queue)`}
              aria-label="Play next in queue"
            >
              <SkipForward className="h-3 w-3" />
              <span className="text-[10px] tabular-nums">{queue.length}</span>
            </button>
          )}
          <button
            onClick={() => setMinimized(!isMinimized)}
            className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            aria-label={isMinimized ? "Expand player" : "Minimize player"}
          >
            {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          </button>
          <button
            onClick={clearActiveVideo}
            className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close video"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* iframe — hidden via CSS when minimized so playback is never interrupted */}
      <div
        className="relative w-full"
        style={{
          paddingTop: "56.25%",
          display: isMinimized ? "none" : "block",
        }}
      >
        <iframe
          ref={setIframeRef}
          src={iframeSrc}
          title={activeVideoTitle ?? "Video"}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      {/* Queue preview */}
      {!isMinimized && queue.length > 0 && (
        <div className="border-t border-border/50 bg-muted/40 px-3 py-2">
          <div className="flex items-center gap-1 mb-1">
            <ListVideo className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Up next</span>
          </div>
          <p className="text-xs text-foreground truncate">{queue[0].title}</p>
          {queue.length > 1 && (
            <p className="text-[10px] text-muted-foreground">+{queue.length - 1} more in queue</p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Portal wrapper — renders the player directly into document.body so it
 * is completely independent of the Next.js component tree and immune to
 * any stacking context, overflow, or re-mounting issues on any page.
 */
export function PersistentVideoPlayer() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(<VideoPlayerUI />, document.body)
}
