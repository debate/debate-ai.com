"use client"

import React, { useEffect, useRef, useState, useCallback } from "react" // useState kept for PersistentVideoPlayer mounted state
import { createPortal } from "react-dom"
import { useVideoPlayerStore, videoPlayerIframeRef, sendYouTubeCommand } from "@/lib/state/videoPlayerStore"
import { useDragResize } from "./useDragResize"
import { PlayerTitleBar } from "./PlayerTitleBar"
import { PlayerControls } from "./PlayerControls"
import { PlayerQueue } from "./PlayerQueue"
import { PlayerResizeHandles } from "./PlayerResizeHandles"

function VideoPlayerUI() {
  const {
    activeVideoId,
    activeVideoTitle,
    activeVideoMeta,
    isMinimized,
    isPlaying,
    isSlowMode,
    queue,
    clearActiveVideo,
    setMinimized,
    setIsPlaying,
    setSlowMode,
    playNextInQueue,
  } = useVideoPlayerStore()

  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  // Track whether we still need to apply slow mode for the current video load
  const pendingSlowMode = useRef(false)

  const { position, isDragging, isResizing, playerWidth, startDrag, startResize } = useDragResize(containerRef)

  const setIframeRef = useCallback((el: HTMLIFrameElement | null) => {
    iframeRef.current = el
    videoPlayerIframeRef.current = el
  }, [])

  // When a new video opens, mark that slow mode needs to be applied on first play
  useEffect(() => {
    if (activeVideoId && isSlowMode) {
      pendingSlowMode.current = true
    }
  }, [activeVideoId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for YouTube IFrame API state change events
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube.com") return
      try {
        const data = JSON.parse(event.data)
        if (data.event === "onStateChange") {
          if (data.info === 1 || data.info === 3) {
            setIsPlaying(true)
            // Apply slow mode on the first playing event after a new video loads
            if (pendingSlowMode.current) {
              pendingSlowMode.current = false
              sendYouTubeCommand("setPlaybackRate", [0.65])
            }
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

  const handleToggleSlowMode = useCallback(() => {
    const next = !isSlowMode
    setSlowMode(next)
    sendYouTubeCommand("setPlaybackRate", [next ? 0.65 : 1])
  }, [isSlowMode, setSlowMode])

  if (!activeVideoId) return null

  const iframeSrc = `https://www.youtube.com/embed/${activeVideoId}?autoplay=1&enablejsapi=1&controls=1&rel=0`

  const positionStyle: React.CSSProperties = position
    ? { left: position.x, top: position.y, bottom: "auto", right: "auto" }
    : {}

  const widthStyle: React.CSSProperties = playerWidth && !isMinimized
    ? { width: playerWidth }
    : {}

  return (
    <div
      ref={containerRef}
      className={`fixed bottom-20 right-4 md:bottom-6 z-[9999] shadow-2xl rounded-xl overflow-hidden border border-border bg-background transition-[width,height] duration-300 ${isMinimized ? "w-64 h-10" : playerWidth ? "" : "w-72 sm:w-80"}`}
      style={{ maxWidth: "calc(100vw - 2rem)", ...positionStyle, ...widthStyle }}
    >
      {/* Title bar — drag handle */}
      <div
        className={`flex items-center justify-between px-3 py-2 bg-muted/80 backdrop-blur-sm gap-2 select-none touch-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return
          e.preventDefault()
          startDrag(e.clientX, e.clientY)
        }}
        onTouchStart={(e) => {
          if ((e.target as HTMLElement).closest("button")) return
          startDrag(e.touches[0].clientX, e.touches[0].clientY)
        }}
      >
        <PlayerTitleBar activeVideoMeta={activeVideoMeta} activeVideoTitle={activeVideoTitle} />
        <PlayerControls
          isPlaying={isPlaying}
          isMinimized={isMinimized}
          isSlowMode={isSlowMode}
          queue={queue}
          onPlayPause={handlePlayPause}
          onToggleSlowMode={handleToggleSlowMode}
          onPlayNext={playNextInQueue}
          onToggleMinimize={() => setMinimized(!isMinimized)}
          onClose={clearActiveVideo}
        />
      </div>

      {/* iframe — hidden via CSS when minimized so playback is never interrupted */}
      <div
        className="relative w-full"
        style={{ paddingTop: "56.25%", display: isMinimized ? "none" : "block" }}
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

      {!isMinimized && <PlayerQueue queue={queue} />}
      {!isMinimized && <PlayerResizeHandles isResizing={isResizing} startResize={startResize} />}
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
