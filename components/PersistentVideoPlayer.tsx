"use client"

import { X, Minus, Maximize2, SkipForward, ListVideo } from "lucide-react"
import { useVideoPlayerStore } from "@/lib/state/videoPlayerStore"

/**
 * A persistent floating video player that keeps the YouTube iframe alive
 * across all page navigation. Once a video is started, this component renders
 * the iframe in a fixed-position element so it never gets unmounted, allowing
 * playback to continue uninterrupted when the user switches tabs or pages.
 *
 * Supports a play queue — "Add to Queue" from any video card enqueues the video
 * to play after the current one finishes (or when the user presses SkipForward).
 */
export function PersistentVideoPlayer() {
  const { activeVideoId, activeVideoTitle, isMinimized, queue, clearActiveVideo, setMinimized, playNextInQueue } = useVideoPlayerStore()

  if (!activeVideoId) return null

  return (
    <div
      className={`fixed bottom-20 right-4 md:bottom-6 z-50 shadow-2xl rounded-xl overflow-hidden border border-border bg-background transition-all duration-300 ${
        isMinimized ? "w-64 h-10" : "w-72 sm:w-80"
      }`}
      style={{ maxWidth: "calc(100vw - 2rem)" }}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/80 backdrop-blur-sm gap-2">
        <span className="text-xs font-medium text-foreground truncate flex-1 min-w-0">
          {activeVideoTitle ?? "Playing video"}
        </span>
        <div className="flex items-center gap-1 shrink-0">
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

      {/* iframe — always mounted, hidden via CSS when minimized so playback is never interrupted */}
      <div
        className="relative w-full"
        style={{
          paddingTop: "56.25%",
          display: isMinimized ? "none" : "block",
        }}
      >
        <iframe
          src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1`}
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
