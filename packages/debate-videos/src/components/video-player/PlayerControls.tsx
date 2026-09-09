/**
 * @fileoverview Player control buttons component for video player UI.
 *
 * Only controls that mean the same thing for any video live here. Anything
 * debate-specific — the slow-the-spread speed toggle, say — is passed in as
 * `extraControls` by whoever mounts the player, so this strip stays generic
 * and matches the seam in the extracted `extract-youtube/react` package.
 */

import type { ReactNode } from "react"
import { X, Minus, Maximize2, SkipForward, Play, Pause, PictureInPicture2, Captions } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../../ui/primitives/tooltip"
import type { QueueItem } from "../../state/videoPlayerStore"

interface PlayerControlsProps {
  isPlaying: boolean
  isMinimized: boolean
  queue: QueueItem[]
  isPipSupported: boolean
  isPipActive: boolean
  isSubtitlesOpen: boolean
  /** Host-supplied buttons, rendered right after play/pause. */
  extraControls?: ReactNode
  onPlayPause: () => void
  onPlayNext: () => void
  onToggleMinimize: () => void
  onTogglePip: () => void
  onToggleSubtitles: () => void
  onClose: () => void
}

export function PlayerControls({
  isPlaying,
  isMinimized,
  queue,
  isPipSupported,
  isPipActive,
  isSubtitlesOpen,
  extraControls,
  onPlayPause,
  onPlayNext,
  onToggleMinimize,
  onTogglePip,
  onToggleSubtitles,
  onClose,
}: PlayerControlsProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onPlayPause}
              className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              aria-label={isPlaying ? "Pause video" : "Play video"}
            >
              {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {isPlaying ? "Pause" : "Play"}
          </TooltipContent>
        </Tooltip>

        {extraControls}

        {queue.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onPlayNext}
                className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                aria-label="Play next in queue"
              >
                <SkipForward className="h-3 w-3" />
                <span className="text-[10px] tabular-nums">{queue.length}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Skip to next ({queue.length} in queue)
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onToggleSubtitles}
              className={`p-1 rounded hover:bg-accent transition-colors ${isSubtitlesOpen ? "text-primary bg-accent" : "text-muted-foreground hover:text-foreground"}`}
              aria-label={isSubtitlesOpen ? "Hide subtitles" : "Show subtitles"}
            >
              <Captions className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {isSubtitlesOpen ? "Hide subtitles" : "Show subtitles"}
          </TooltipContent>
        </Tooltip>

        {isPipSupported && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onTogglePip}
                className={`p-1 rounded hover:bg-accent transition-colors ${isPipActive ? "text-primary bg-accent" : "text-muted-foreground hover:text-foreground"}`}
                aria-label={isPipActive ? "Exit picture-in-picture" : "Pop out picture-in-picture"}
              >
                <PictureInPicture2 className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {isPipActive ? "Exit picture-in-picture" : "Pop out picture-in-picture"}
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onToggleMinimize}
              className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              aria-label={isMinimized ? "Expand player" : "Minimize player"}
            >
              {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-48 text-center">
            {isMinimized ? "Expand player" : "Minimize player"}
            <br />
            <span className="text-muted-foreground">Drag to move · Resize from edges</span>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Close video"
            >
              <X className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Close player
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
