"use client"

import React, { useEffect, useRef, useState, useCallback } from "react" // useState kept for PersistentVideoPlayer mounted state
import { createPortal } from "react-dom"
import { useVideoPlayerStore, videoPlayerIframeRef, sendYouTubeCommand } from "@/lib/state/videoPlayerStore"
import { savePlayerState, loadPlayerState, clearSavedPlayerState } from "@/lib/state/videoPlayerPersistence"
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
    startTime,
    clearActiveVideo,
    setMinimized,
    setIsPlaying,
    setSlowMode,
    playNextInQueue,
    restoreVideo,
  } = useVideoPlayerStore()

  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  // Track whether we still need to apply slow mode for the current video load
  const pendingSlowMode = useRef(false)

  // Time tracking refs for persisting playback position
  const playStartedAtRef = useRef<number | null>(null) // Date.now() when video last started playing
  const timeOffsetRef = useRef<number>(0) // accumulated seconds before last play event

  const { position, isDragging, isResizing, playerWidth, startDrag, startResize } = useDragResize(containerRef)

  const setIframeRef = useCallback((el: HTMLIFrameElement | null) => {
    iframeRef.current = el
    videoPlayerIframeRef.current = el
  }, [])

  /** Return the current estimated playback time in seconds */
  const getCurrentTime = useCallback((): number => {
    if (playStartedAtRef.current !== null) {
      return timeOffsetRef.current + (Date.now() - playStartedAtRef.current) / 1000
    }
    return timeOffsetRef.current
  }, [])

  /** Persist current player state to localStorage */
  const persistState = useCallback(() => {
    const store = useVideoPlayerStore.getState()
    if (!store.activeVideoId) return
    savePlayerState({
      videoId: store.activeVideoId,
      title: store.activeVideoTitle ?? "",
      meta: store.activeVideoMeta,
      isMinimized: store.isMinimized,
      isSlowMode: store.isSlowMode,
      queue: store.queue,
      savedTime: getCurrentTime(),
    })
  }, [getCurrentTime])

  // On mount, restore player state from localStorage if no video is currently playing
  useEffect(() => {
    const store = useVideoPlayerStore.getState()
    if (!store.activeVideoId) {
      const saved = loadPlayerState()
      if (saved) {
        // Reset time tracking for the restored video
        timeOffsetRef.current = saved.savedTime
        playStartedAtRef.current = null
        restoreVideo(saved.videoId, saved.title, saved.meta, {
          isMinimized: saved.isMinimized,
          isSlowMode: saved.isSlowMode,
          queue: saved.queue,
          savedTime: saved.savedTime,
        })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally runs once on mount only

  // Reset time tracking when a new video is opened (not via restore)
  const prevVideoIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (activeVideoId && activeVideoId !== prevVideoIdRef.current) {
      // If a new video was user-selected (startTime is 0), reset tracking
      if (prevVideoIdRef.current !== null || startTime === 0) {
        // Only reset if this isn't a fresh restore (startTime > 0 means restore)
        if (startTime === 0) {
          timeOffsetRef.current = 0
          playStartedAtRef.current = null
        }
      }
      prevVideoIdRef.current = activeVideoId
    }
  }, [activeVideoId, startTime])

  // When a new video opens, mark that slow mode needs to be applied on first play
  useEffect(() => {
    if (activeVideoId) {
      if (isSlowMode) {
        pendingSlowMode.current = true
      } else {
        pendingSlowMode.current = false
      }
    }
  }, [activeVideoId, isSlowMode])

  // Listen for YouTube IFrame API state change events
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube.com") return
      try {
        const data = JSON.parse(event.data)
        if (data.event === "onStateChange") {
          if (data.info === 1 || data.info === 3) {
            // Playing or buffering — start tracking time
            if (playStartedAtRef.current === null) {
              playStartedAtRef.current = Date.now()
            }
            setIsPlaying(true)
            // Apply slow mode on the first playing event after a new video loads
            if (pendingSlowMode.current) {
              pendingSlowMode.current = false
              sendYouTubeCommand("setPlaybackRate", [0.65])
            }
          } else if (data.info === 2 || data.info === 0) {
            // Paused or ended — accumulate elapsed time
            if (playStartedAtRef.current !== null) {
              timeOffsetRef.current += (Date.now() - playStartedAtRef.current) / 1000
              playStartedAtRef.current = null
            }
            setIsPlaying(false)
            persistState()
          }
        }
        // YouTube infoDelivery includes currentTime when available — use it for accuracy
        if (data.event === "infoDelivery" && data.info?.currentTime != null) {
          const yt = data.info.currentTime as number
          // Sync our tracking with YouTube's reported time
          timeOffsetRef.current = yt
          if (playStartedAtRef.current !== null) {
            playStartedAtRef.current = Date.now()
          }
        }
      } catch {
        // ignore non-JSON messages
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [setIsPlaying, persistState])

  // Periodically save state while playing (every 10 seconds)
  useEffect(() => {
    if (!isPlaying || !activeVideoId) return
    const interval = setInterval(persistState, 10_000)
    return () => clearInterval(interval)
  }, [isPlaying, activeVideoId, persistState])

  // Save state when the page is closed or hidden (mobile background)
  useEffect(() => {
    const handleBeforeUnload = () => persistState()
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") persistState()
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [persistState])

  const handlePlayPause = useCallback(() => {
    sendYouTubeCommand(isPlaying ? "pauseVideo" : "playVideo")
    setIsPlaying(!isPlaying)
  }, [isPlaying, setIsPlaying])

  const handleToggleSlowMode = useCallback(() => {
    const next = !isSlowMode
    setSlowMode(next)
    sendYouTubeCommand("setPlaybackRate", [next ? 0.65 : 1])
  }, [isSlowMode, setSlowMode])

  const handleClose = useCallback(() => {
    // User explicitly closed — clear saved state so it doesn't auto-restore
    clearSavedPlayerState()
    clearActiveVideo()
  }, [clearActiveVideo])

  if (!activeVideoId) return null

  const startParam = startTime > 0 ? `&start=${Math.floor(startTime)}` : ""
  const iframeSrc = `https://www.youtube.com/embed/${activeVideoId}?autoplay=1&enablejsapi=1&controls=1&rel=0${startParam}`

  const positionStyle: React.CSSProperties = position
    ? { left: position.x, top: position.y, bottom: "auto", right: "auto" }
    : {}

  const widthStyle: React.CSSProperties = playerWidth && !isMinimized
    ? { width: playerWidth }
    : {}

  return (
    <div
      ref={containerRef}
      className={`fixed bottom-20 right-4 md:bottom-6 z-[9999] shadow-2xl rounded-xl overflow-hidden border border-border bg-background transition-[width,height] duration-300 ${isMinimized ? "w-64 h-10" : playerWidth ? "" : "w-[360px] sm:w-[400px]"}`}
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
          onClose={handleClose}
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
