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

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import {
  ArrowLeft,
  Captions,
  Check,
  ChevronDown,
  ExternalLink,
  Link2,
  ListVideo,
  Maximize,
  Minimize,
  Minus,
  Pause,
  PictureInPicture2,
  PictureInPicture,
  Play,
  RotateCcw,
  SkipForward,
  Star,
  X,
} from "lucide-react"
import { TooltipProvider } from "../../../ui/primitives/tooltip"
import { PlayerIconButton, PlayerIconLink } from "../player/PlayerIconButton"
import type { QueueItem } from "../../../state/videoPlayerStore"
import { COPY_FORMATS, type CopyFormat } from "../../../lib/copy-format"

interface WatchToolbarProps {
  /**
   * Where the back arrow at the very start of the strip goes — the video
   * library. The arrow is left out when this is not given.
   */
  backHref?: string
  /**
   * Client-side navigation for a plain click on the back arrow; modified
   * clicks (new tab, new window) still follow `backHref` natively.
   */
  onBack?: () => void
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
  /** What the copy button puts on the clipboard; see `lib/copy-format`. */
  copyFormat: CopyFormat
  youtubeUrl: string
  /** Host-supplied buttons, rendered right after play/pause — see `SlowSpreadButton`. */
  extraControls?: ReactNode
  /** Whether the video should keep playing after it ends. */
  autoplay: boolean
  onPlayPause: () => void
  onToggleAutoplay: () => void
  onPlayNext: () => void
  onTogglePip: () => void
  onToggleFullscreen: () => void
  onToggleTranscript: () => void
  onToggleFavorite: () => void
  onAddToQueue: () => void
  onCopyLink: () => void
  /** Saves a new copy format and copies in it straight away. */
  onCopyFormatChange: (format: CopyFormat) => void
  /**
   * Open the video in the mini player window — a small separate window with
   * a speech switcher, which the desktop app can keep on top of other apps.
   * The control is left out when this is not given.
   */
  onOpenMiniWindow?: () => void
  /** Leave the page and hand playback back to the floating popout player. */
  onPopOut: () => void
  /** Stop playback and return to the video library. */
  onClose: () => void
}

export function WatchToolbar({
  backHref,
  onBack,
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
  copyFormat,
  youtubeUrl,
  extraControls,
  autoplay,
  onPlayPause,
  onToggleAutoplay,
  onPlayNext,
  onTogglePip,
  onToggleFullscreen,
  onToggleTranscript,
  onToggleFavorite,
  onAddToQueue,
  onCopyLink,
  onCopyFormatChange,
  onOpenMiniWindow,
  onPopOut,
  onClose,
}: WatchToolbarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 flex-wrap">
        {backHref && (
          <PlayerIconLink
            size="md"
            icon={ArrowLeft}
            label="Video library"
            href={backHref}
            onClick={(event) => {
              if (!onBack) return
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
              event.preventDefault()
              onBack()
            }}
          />
        )}

        <PlayerIconButton
          size="md"
          icon={isPlaying ? Pause : Play}
          label={isPlaying ? "Pause video" : "Play video"}
          tooltip={isPlaying ? "Pause" : "Play"}
          onClick={onPlayPause}
        />

        {extraControls}

        <PlayerIconButton
          size="md"
          icon={RotateCcw}
          label={autoplay ? "Autoplay on" : "Autoplay off"}
          tooltip={autoplay ? "Autoplay next video when this ends" : "Autoplay next video when this ends"}
          active={autoplay}
          onClick={onToggleAutoplay}
        />

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
          <CopyLinkControl
            isCopied={isLinkCopied}
            format={copyFormat}
            onCopy={onCopyLink}
            onFormatChange={onCopyFormatChange}
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

        {onOpenMiniWindow && (
          <PlayerIconButton
            size="md"
            icon={PictureInPicture}
            label="Pop out mini player"
            tooltip={
              <>
                Pop out mini player
                <br />
                <span className="text-muted-foreground">A small window with the round's speeches</span>
              </>
            }
            tooltipClassName="max-w-48 text-center"
            onClick={onOpenMiniWindow}
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

/** The copy button's tooltip and accessible name for each format. */
const COPY_LABELS: Record<CopyFormat, string> = {
  url: "Copy link to this video",
  "url-title": "Copy link and title",
  citation: "Copy citation (Chicago)",
}

interface CopyLinkControlProps {
  isCopied: boolean
  format: CopyFormat
  onCopy: () => void
  onFormatChange: (format: CopyFormat) => void
}

/**
 * The copy button with a menu beside it choosing what it copies: the URL
 * alone, the URL with the title, or a Chicago citation. The page remembers
 * the choice, so the button keeps copying in it until another is picked.
 *
 * A small hand-rolled menu rather than a Radix dropdown: the package has no
 * menu primitive, and three radio items do not justify a new dependency.
 */
function CopyLinkControl({ isCopied, format, onCopy, onFormatChange }: CopyLinkControlProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!isOpen) return
    const handlePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false)
    }
    document.addEventListener("pointerdown", handlePointer)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("pointerdown", handlePointer)
      document.removeEventListener("keydown", handleKey)
    }
  }, [isOpen])

  const label = COPY_LABELS[format]

  return (
    <div ref={containerRef} className="relative flex items-center">
      <PlayerIconButton
        size="md"
        icon={isCopied ? Check : Link2}
        label={label}
        tooltip={isCopied ? "Copied" : label}
        active={isCopied}
        onClick={onCopy}
      />
      <PlayerIconButton
        size="md"
        icon={ChevronDown}
        label="Choose what to copy"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        className="-ml-1 px-0.5"
        onClick={() => setIsOpen((open) => !open)}
      />
      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label="What to copy"
          className="absolute left-0 top-full z-50 mt-1 min-w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {COPY_FORMATS.map((option) => {
            const checked = option.value === format
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => {
                  setIsOpen(false)
                  onFormatChange(option.value)
                }}
              >
                <span
                  aria-hidden="true"
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-muted-foreground/50"
                >
                  {checked && <Check className="h-3 w-3" />}
                </span>
                {option.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
