/**
 * @fileoverview Persistent video player with drag, resize, and playback state management
 */

"use client"

import React, { useEffect, useRef, useState, useCallback } from "react" // useState kept for PersistentVideoPlayer mounted state
import { createPortal } from "react-dom"
import { AlertCircle } from "lucide-react"
import { useVideoPlayerStore, videoPlayerIframeRef, sendYouTubeCommand } from "../../state/videoPlayerStore"
import { savePlayerState, loadPlayerState, clearSavedPlayerState } from "../../state/videoPlayerPersistence"
import { useDragResize } from "./useDragResize"
import { useDocumentPictureInPicture } from "./useDocumentPictureInPicture"
import { PlayerTitleBar } from "./PlayerTitleBar"
import { PlayerControls } from "./PlayerControls"
import { PlayerQueue } from "./PlayerQueue"
import { PlayerResizeHandles } from "./PlayerResizeHandles"
import { PlayerSubtitles } from "./PlayerSubtitles"
import { buildEmbedUrl, describePlayerError, startListening, watchUrl } from "./youtubeEmbed"

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
    setGetCurrentTimeRef,
  } = useVideoPlayerStore()

  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const videoWrapperRef = useRef<HTMLDivElement | null>(null)
  // Track whether we still need to apply slow mode for the current video load
  const pendingSlowMode = useRef(false)

  const { isSupported: isPipSupported, isActive: isPipActive, toggle: togglePip, exit: exitPip } = useDocumentPictureInPicture(videoWrapperRef)

  const [showSubtitles, setShowSubtitles] = useState(false)
  const [subtitleTime, setSubtitleTime] = useState(0)
  // Error code reported by the YouTube IFrame API for the current load, if any
  const [playerError, setPlayerError] = useState<number | null>(null)
  // Bumped to force a fresh iframe when the user retries after an error
  const [reloadKey, setReloadKey] = useState(0)
  // Position to resume from after a reload the app causes itself (popping the
  // iframe in/out of the PiP window re-creates it, restarting playback at 0)
  const [resumeSeconds, setResumeSeconds] = useState<number | null>(null)

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

  // Register getCurrentTime function with the store so it can be used when switching videos
  useEffect(() => {
    setGetCurrentTimeRef(getCurrentTime)
    return () => setGetCurrentTimeRef(null)
  }, [getCurrentTime, setGetCurrentTimeRef])

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

  // A new video starts from a clean slate: no stale error, no resume offset
  useEffect(() => {
    setPlayerError(null)
    setResumeSeconds(null)
  }, [activeVideoId])

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
        if (data.event === "onError") {
          const code = typeof data.info === "number" ? data.info : Number(data.info?.errorCode)
          if (!Number.isNaN(code)) setPlayerError(code)
          return
        }
        if (data.event === "onStateChange") {
          setPlayerError(null)
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
        // Older embeds report failures through infoDelivery rather than onError
        if (data.event === "infoDelivery" && data.info?.errorCode != null) {
          const code = Number(data.info.errorCode)
          if (!Number.isNaN(code)) setPlayerError(code)
        }
        // YouTube infoDelivery includes currentTime when available — use it for accuracy
        if (data.event === "infoDelivery" && data.info?.currentTime != null) {
          const yt = data.info.currentTime as number
          // Sync our tracking with YouTube's reported time
          timeOffsetRef.current = yt
          if (playStartedAtRef.current !== null) {
            playStartedAtRef.current = Date.now()
          }
          if (showSubtitles) setSubtitleTime(yt)
        }
      } catch {
        // ignore non-JSON messages
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [setIsPlaying, persistState, showSubtitles])

  // Re-send the "listening" handshake for a few seconds after every embed load.
  // `onLoad` alone is not enough: React's delegated events stop reaching the
  // iframe once it is moved into the PiP window, and YouTube ignores commands
  // until the handshake lands, so retry until the embed is ready.
  useEffect(() => {
    if (!activeVideoId) return
    let attempts = 0
    startListening(iframeRef.current)
    const interval = setInterval(() => {
      startListening(iframeRef.current)
      if (++attempts >= 12) clearInterval(interval)
    }, 400)
    return () => clearInterval(interval)
  }, [activeVideoId, reloadKey, resumeSeconds, isPipActive])

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

  /**
   * Moving the iframe into (or out of) the PiP window re-creates it, so capture
   * where playback is first and hand it back to the fresh embed as `start`.
   */
  const handleTogglePip = useCallback(() => {
    setResumeSeconds(getCurrentTime())
    void togglePip()
  }, [getCurrentTime, togglePip])

  /** Re-create the embed after an error, resuming from the tracked position. */
  const handleRetry = useCallback(() => {
    setPlayerError(null)
    setResumeSeconds(getCurrentTime())
    setReloadKey((key) => key + 1)
  }, [getCurrentTime])

  /** Register for player events; without the handshake YouTube posts nothing. */
  const handleIframeLoad = useCallback(() => {
    startListening(iframeRef.current)
  }, [])

  const handleClose = useCallback(() => {
    // User explicitly closed — clear saved state so it doesn't auto-restore
    exitPip()
    clearSavedPlayerState()
    clearActiveVideo()
  }, [clearActiveVideo, exitPip])

  const handleToggleSubtitles = useCallback(() => {
    setShowSubtitles((prev) => {
      const next = !prev
      if (next && isMinimized) setMinimized(false)
      return next
    })
  }, [isMinimized, setMinimized])

  const handleSubtitleSeek = useCallback((seconds: number) => {
    sendYouTubeCommand("seekTo", [seconds, true])
    sendYouTubeCommand("playVideo")
  }, [])

  if (!activeVideoId) return null

  const startSeconds = resumeSeconds ?? startTime
  const iframeSrc = buildEmbedUrl(activeVideoId, { autoplay: true, controls: true, startSeconds })

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
          isPipSupported={isPipSupported}
          isPipActive={isPipActive}
          isSubtitlesOpen={showSubtitles}
          onPlayPause={handlePlayPause}
          onToggleSlowMode={handleToggleSlowMode}
          onPlayNext={playNextInQueue}
          onToggleMinimize={() => setMinimized(!isMinimized)}
          onTogglePip={handleTogglePip}
          onToggleSubtitles={handleToggleSubtitles}
          onClose={handleClose}
        />
      </div>

      {/* Subtitles panel — shown above the video, enlarging the widget, synced to playback. */}
      {showSubtitles && !isMinimized && (
        <PlayerSubtitles videoId={activeVideoId} currentTime={subtitleTime} onSeek={handleSubtitleSeek} />
      )}

      {/* iframe — hidden via CSS when minimized so playback is never interrupted. */}
      {/* While popped out, this node lives inside the PiP window, so it's always shown there regardless of isMinimized. */}
      <div
        ref={videoWrapperRef}
        className="relative w-full"
        style={
          isPipActive
            ? { position: "absolute", inset: 0, width: "100%", height: "100%" }
            : { paddingTop: "56.25%", display: isMinimized ? "none" : "block" }
        }
      >
        <iframe
          key={reloadKey}
          ref={setIframeRef}
          src={iframeSrc}
          title={activeVideoTitle ?? "Video"}
          onLoad={handleIframeLoad}
          className="absolute inset-0 w-full h-full"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />

        {playerError !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/95 p-4 text-center">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <p className="text-xs text-muted-foreground">{describePlayerError(playerError)}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRetry}
                className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
              >
                Retry
              </button>
              <a
                href={watchUrl(activeVideoId, getCurrentTime())}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
              >
                Watch on YouTube
              </a>
            </div>
          </div>
        )}
      </div>

      {!isMinimized && !isPipActive && <PlayerQueue queue={queue} />}
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
