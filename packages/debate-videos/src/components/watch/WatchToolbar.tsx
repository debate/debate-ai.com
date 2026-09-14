/**
 * @fileoverview The control strip above the video on the watch page.
 *
 * Deliberately the same controls, icons and tooltips as the floating popout
 * player's strip — they are the same {@link PlayerIconButton}s, one size up —
 * plus the three that only a page can offer: a permalink to copy, a favourite
 * toggle, and fullscreen.
 *
 * "Minimize" means on this page what it means in the popout player: shrink
 * the video out of the way. Here that is leaving the page for the library,
 * with the floating player picking playback up where this one left it.
 * @module components/watch/WatchToolbar
 */

"use client"

import type { ReactNode } from "react"
import {
  Captions,
  Check,
  ExternalLink,
  Link2,
  ListVideo,
  Maximize,
  Minimize,
  Minus,
  Pause,
  PictureInPicture2,
  Play,
  SkipForward,
  Star,
  X,
} from "lucide-react"
import { TooltipProvider } from "../../ui/primitives/tooltip"
import { PlayerIconButton, PlayerIconLink } from "../video-player/PlayerIconButton"
import type { QueueItem } from "../../state/videoPlayerStore"

interface WatchToolbarProps {
  isPlaying: boolean
  queue: QueueItem[]
  isPipSupported: boolean
  isPipActive: boolean
  isFullscreen: boolean
  isTranscriptOpen: boolean
  /** Whether this video has a transcript at all; hides the captions control when it doesn't. */
  hasTranscript: boolean
  isFavorite: boolean
  isInQueue: boolean
  /** Shows the "copied" tick for a moment after the permalink is copied. */
  isLinkCopied: boolean
  /** Whether the browser exposed a clipboard to copy the permalink with. */
  canCopyLink: boolean
  youtubeUrl: string
  /** Host-supplied buttons, rendered right after play/pause — see `SlowSpreadButton`. */
  extraControls?: ReactNode
  onPlayPause: () => void
  onPlayNext: () => void
  onTogglePip: () => void
  onToggleFullscreen: () => void
  onToggleTranscript: () => void
  onToggleFavorite: () => void
  onAddToQueue: () => void
  onCopyLink: () => void
  /** Leave the page and hand playback back to the floating popout player. */
  onPopOut: () => void
  /** Stop playback and return to the video library. */
  onClose: () => void
}

export function WatchToolbar({
  isPlaying,
  queue,
  isPipSupported,
  isPipActive,
  isFullscreen,
  isTranscriptOpen,
  hasTranscript,
  isFavorite,
  isInQueue,
  isLinkCopied,
  canCopyLink,
  youtubeUrl,
  extraControls,
  onPlayPause,
  onPlayNext,
  onTogglePip,
  onToggleFullscreen,
  onToggleTranscript,
  onToggleFavorite,
  onAddToQueue,
  onCopyLink,
  onPopOut,
  onClose,
}: WatchToolbarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 flex-wrap">
        <PlayerIconButton
          size="md"
          icon={isPlaying ? Pause : Play}
          label={isPlaying ? "Pause video" : "Play video"}
          tooltip={isPlaying ? "Pause" : "Play"}
          onClick={onPlayPause}
        />

        {extraControls}

        {queue.length > 0 && (
          <PlayerIconButton
            size="md"
            icon={SkipForward}
            label="Play next in queue"
            tooltip={`Skip to next (${queue.length} in queue)`}
            onClick={onPlayNext}
            badge={<span className="text-[10px] tabular-nums">{queue.length}</span>}
          />
        )}

        {hasTranscript && (
          <PlayerIconButton
            size="md"
            icon={Captions}
            label={isTranscriptOpen ? "Hide transcript" : "Show transcript"}
            active={isTranscriptOpen}
            onClick={onToggleTranscript}
          />
        )}

        <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />

        <PlayerIconButton
          size="md"
          icon={Star}
          label={isFavorite ? "Remove from My Favorites" : "Star to add to My Favorites"}
          active={isFavorite}
          className={isFavorite ? "text-amber-600 dark:text-amber-400 bg-transparent" : undefined}
          onClick={onToggleFavorite}
        />

        <PlayerIconButton
          size="md"
          icon={ListVideo}
          label={isInQueue ? "In queue" : "Add to queue"}
          disabled={isInQueue}
          onClick={onAddToQueue}
        />

        {canCopyLink && (
          <PlayerIconButton
            size="md"
            icon={isLinkCopied ? Check : Link2}
            label="Copy link to this video"
            tooltip={isLinkCopied ? "Link copied" : "Copy link to this video"}
            active={isLinkCopied}
            onClick={onCopyLink}
          />
        )}

        <PlayerIconLink
          size="md"
          icon={ExternalLink}
          label="Watch on YouTube"
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
        />

        <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />

        {isPipSupported && (
          <PlayerIconButton
            size="md"
            icon={PictureInPicture2}
            label={isPipActive ? "Exit picture-in-picture" : "Pop out picture-in-picture"}
            active={isPipActive}
            onClick={onTogglePip}
          />
        )}

        <PlayerIconButton
          size="md"
          icon={isFullscreen ? Minimize : Maximize}
          label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          active={isFullscreen}
          onClick={onToggleFullscreen}
        />

        <PlayerIconButton
          size="md"
          icon={Minus}
          label="Minimize to the popout player"
          tooltip={
            <>
              Minimize to the popout player
              <br />
              <span className="text-muted-foreground">Keeps playing while you browse</span>
            </>
          }
          tooltipClassName="max-w-48 text-center"
          onClick={onPopOut}
        />

        <PlayerIconButton
          size="md"
          icon={X}
          label="Close video"
          tooltip="Close and return to the library"
          onClick={onClose}
        />
      </div>
    </TooltipProvider>
  )
}
