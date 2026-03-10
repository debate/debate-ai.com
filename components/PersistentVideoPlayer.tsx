"use client"

import { X, Minus, Maximize2 } from "lucide-react"
import { useVideoPlayerStore } from "@/lib/state/videoPlayerStore"

/**
 * A persistent floating video player that keeps the YouTube iframe alive
 * across all page navigation. Once a video is started, this component renders
 * the iframe in a fixed-position element so it never gets unmounted, allowing
 * playback to continue uninterrupted when the user switches tabs or pages.
 */
export function PersistentVideoPlayer() {
  const { activeVideoId, activeVideoTitle, isMinimized, clearActiveVideo, setMinimized } = useVideoPlayerStore()

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
    </div>
  )
}
