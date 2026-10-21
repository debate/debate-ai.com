/**
 * @fileoverview Player control buttons component for video player UI.
 *
 * Only controls that mean the same thing for any video live here. Anything
 * debate-specific — the slow-the-spread speed toggle, say — is passed in as
 * `extraControls` by whoever mounts the player, so this strip stays generic
 * and matches the seam in the extracted `extract-youtube/react` package.
 *
 * The buttons themselves are {@link PlayerIconButton}s, shared with the
 * full-page watch toolbar so the same control never drifts between the two.
 */

import type { ReactNode } from "react"
import { X, Minus, Maximize2, SkipForward, Play, Pause, PictureInPicture2, Captions } from "lucide-react"
import { TooltipProvider } from "../../ui/primitives/tooltip"
import { PlayerIconButton } from "./PlayerIconButton"
import type { QueueItem } from "../../state/videoPlayerStore"

interface PlayerControlsProps {
  isPlaying: boolean
  isMinimized: boolean
  queue: QueueItem[]
  isPipSupported: boolean
  isPipActive: boolean
  isSubtitlesOpen: boolean
  /** Whether the current video has a transcript to show. Hides the button when it doesn't. */
  showSubtitles: boolean
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
  showSubtitles,
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
        <PlayerIconButton
          icon={isPlaying ? Pause : Play}
          label={isPlaying ? "Pause video" : "Play video"}
          tooltip={isPlaying ? "Pause" : "Play"}
          onClick={onPlayPause}
        />

        {extraControls}

        {queue.length > 0 && (
          <PlayerIconButton
            icon={SkipForward}
            label="Play next in queue"
            tooltip={`Skip to next (${queue.length} in queue)`}
            onClick={onPlayNext}
            badge={<span className="text-[10px] tabular-nums">{queue.length}</span>}
          />
        )}

        {showSubtitles && (
          <PlayerIconButton
            icon={Captions}
            label={isSubtitlesOpen ? "Hide subtitles" : "Show subtitles"}
            active={isSubtitlesOpen}
            onClick={onToggleSubtitles}
          />
        )}

        {isPipSupported && (
          <PlayerIconButton
            icon={PictureInPicture2}
            label={isPipActive ? "Exit picture-in-picture" : "Pop out picture-in-picture"}
            active={isPipActive}
            onClick={onTogglePip}
          />
        )}

        <PlayerIconButton
          icon={isMinimized ? Maximize2 : Minus}
          label={isMinimized ? "Expand player" : "Minimize player"}
          tooltip={
            <>
              {isMinimized ? "Expand player" : "Minimize player"}
              <br />
              <span className="text-muted-foreground">Drag to move · Resize from edges</span>
            </>
          }
          tooltipClassName="max-w-48 text-center"
          onClick={onToggleMinimize}
        />

        <PlayerIconButton icon={X} label="Close video" tooltip="Close player" onClick={onClose} />
      </div>
    </TooltipProvider>
  )
}
