/**
 * @fileoverview The mini player: the watch page cut down to fit a small
 * window — the video, a strip of the round's speeches to jump between, and
 * little else.
 *
 * It is the page the pop-out window loads (`/videos/mini/<videoId>`, see
 * `lib/mini-player-window.ts`). In the desktop app that window can be pinned
 * above every other window, so a debater can keep a round playing while they
 * flow it, cut cards or write in another app.
 *
 * ## It is the only player in its window
 *
 * The window is a document of its own, and the app shell renders no chrome
 * for this route — no floating player, no dock — so the one-player rule
 * holds inside it trivially. The page still registers its iframe as
 * `videoPlayerIframeRef`, so `sendYouTubeCommand` (the speech jumps, the
 * play button) drives this embed. The watch page that opened it pauses its
 * own embed before popping out (see `VideoWatchPage`'s `handleOpenMiniWindow`).
 *
 * ## The speeches come from the same places as the watch page's
 *
 * The documents (written up speech by speech) arrive as props; the reader's
 * own "Mark start" times and the AI's detected speech timing are read from
 * this browser's storage, which the desktop app's windows share — so a
 * speech the reader timed on the watch page is timed here too.
 * @module panels/watch/VideoMiniPlayer
 */

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Maximize2, Pause, Pin, PinOff, Play } from "lucide-react"

import { WatchSpeechTimeline } from "../../components/videos/watch/WatchSpeechTimeline"
import { PlayerIconButton } from "../../components/videos/player/PlayerIconButton"
import { TooltipProvider } from "../../ui/primitives/tooltip"
import { buildEmbedUrl, startListening } from "../../components/videos/player/youtubeEmbed"
import { sendYouTubeCommand, videoPlayerIframeRef } from "../../state/videoPlayerStore"
import { recordWatchProgress } from "../../state/videoWatchHistory"
import { readSpeechStarts } from "../../state/speechStartMarks"
import { readSpeechSegmentation } from "../../state/speechAiCache"
import { applySpeechSegmentation } from "../../lib/speech-segmentation"
import { playingSpeechIndex, withSpeechStarts, type RoundSpeech } from "../../lib/round-speeches"
import { resolveRoundSpeeches } from "../../lib/round-formats"
import type { VideoDocument } from "../../lib/video-documents"
import { videoRouteHref } from "../../lib/video-route"
import {
  isDesktopApp,
  readMiniPlayerOnTop,
  returnToFullPage,
  setMiniPlayerOnTop,
} from "../../lib/mini-player-window"
import type { VideoType } from "../../types/videos"

export interface VideoMiniPlayerProps {
  /** The video to play; see {@link VideoType} for the index map. */
  video: VideoType
  /** The round's documents, for the speech strip; see `VideoWatchPage`. */
  documents?: VideoDocument[]
  /** Second to open at — the watch page's position when it popped out. */
  startSeconds?: number
}

const NO_DOCUMENTS: VideoDocument[] = []

/**
 * The speech before or after the one playing, skipping speeches with no
 * start time (there is nowhere to seek to); exported for the tests.
 *
 * @param direction - `-1` for the previous speech, `1` for the next.
 * @returns The speech to jump to, or `null` at either end of the round.
 */
export function adjacentTimedSpeech(
  speeches: RoundSpeech[],
  currentTime: number,
  direction: -1 | 1,
): RoundSpeech | null {
  const timed = speeches
    .filter((speech) => speech.startSeconds !== null)
    .sort((a, b) => (a.startSeconds as number) - (b.startSeconds as number))
  if (timed.length === 0) return null
  const playing = playingSpeechIndex(timed, currentTime)
  if (direction === 1) return timed[playing + 1] ?? null
  if (playing <= 0) return null
  // A few seconds into a speech, "previous" restarts it — the way a music
  // player's back button works — rather than skipping a whole speech back.
  const current = timed[playing]
  return currentTime - (current.startSeconds as number) > 3 ? current : timed[playing - 1]
}

export function VideoMiniPlayer({ video, documents = NO_DOCUMENTS, startSeconds = 0 }: VideoMiniPlayerProps) {
  const [videoId, title, , , , , style] = video

  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const currentTimeRef = useRef(startSeconds)
  const durationRef = useRef(0)
  const [currentTime, setCurrentTime] = useState(startSeconds)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  /** Only known after mount: the server can't tell whether this is the desktop app. */
  const [isDesktop, setIsDesktop] = useState(false)
  const [isOnTop, setIsOnTop] = useState(true)

  useEffect(() => {
    setIsDesktop(isDesktopApp())
    setIsOnTop(readMiniPlayerOnTop())
  }, [])

  // The same layering the watch page uses: written speeches, then the AI's
  // detected timing, then the reader's own marks on top.
  const baseSpeeches = useMemo(() => resolveRoundSpeeches(documents, style), [documents, style])
  const [speechMarks, setSpeechMarks] = useState<Record<string, number>>({})
  const [segmentation, setSegmentation] = useState<ReturnType<typeof readSpeechSegmentation>>(null)
  useEffect(() => {
    setSpeechMarks(readSpeechStarts(videoId))
    setSegmentation(readSpeechSegmentation(videoId))
  }, [videoId])
  const speeches = useMemo(
    () => withSpeechStarts(applySpeechSegmentation(baseSpeeches, segmentation), speechMarks),
    [baseSpeeches, segmentation, speechMarks],
  )

  // Fixed at mount: changing `src` mid-play would reload the embed.
  const [iframeSrc] = useState(() =>
    buildEmbedUrl(videoId, { autoplay: true, controls: true, startSeconds }),
  )

  const setIframeRef = useCallback((el: HTMLIFrameElement | null) => {
    iframeRef.current = el
    videoPlayerIframeRef.current = el
  }, [])

  // Position, length and play state from the embed's own broadcasts.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube.com") return
      try {
        const data = JSON.parse(event.data)
        if (data.event === "onStateChange") {
          if (data.info === 1 || data.info === 3) setIsPlaying(true)
          else if (data.info === 2 || data.info === 0) {
            setIsPlaying(false)
            recordWatchProgress({
              videoId,
              positionSeconds: currentTimeRef.current,
              durationSeconds: durationRef.current,
              title,
              completed: data.info === 0,
              flush: true,
            })
          }
        }
        if (data.event === "infoDelivery" && data.info?.duration != null) {
          const length = Number(data.info.duration)
          if (Number.isFinite(length) && length > 0) {
            durationRef.current = length
            setDuration(length)
          }
        }
        if (data.event === "infoDelivery" && data.info?.currentTime != null) {
          currentTimeRef.current = Number(data.info.currentTime)
          setCurrentTime(currentTimeRef.current)
          recordWatchProgress({
            videoId,
            positionSeconds: currentTimeRef.current,
            durationSeconds: durationRef.current,
            title,
          })
        }
      } catch {
        // ignore non-JSON messages
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [videoId, title])

  // YouTube posts nothing until the handshake lands; retry it for a few seconds.
  useEffect(() => {
    let attempts = 0
    startListening(iframeRef.current)
    const interval = setInterval(() => {
      startListening(iframeRef.current)
      if (++attempts >= 12) clearInterval(interval)
    }, 400)
    return () => clearInterval(interval)
  }, [])

  // Closing the window is the last chance to save how far this got.
  useEffect(() => {
    const flush = () =>
      recordWatchProgress({
        videoId,
        positionSeconds: currentTimeRef.current,
        durationSeconds: durationRef.current,
        title,
        flush: true,
      })
    window.addEventListener("pagehide", flush)
    return () => {
      window.removeEventListener("pagehide", flush)
      flush()
    }
  }, [videoId, title])

  const seekToSpeech = useCallback((speech: RoundSpeech | null) => {
    if (speech?.startSeconds == null) return
    sendYouTubeCommand("seekTo", [speech.startSeconds, true])
    sendYouTubeCommand("playVideo")
  }, [])

  const handlePlayPause = useCallback(() => {
    sendYouTubeCommand(isPlaying ? "pauseVideo" : "playVideo")
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  const handleToggleOnTop = useCallback(() => {
    const next = !isOnTop
    setIsOnTop(next)
    void setMiniPlayerOnTop(next)
  }, [isOnTop])

  const handleOpenFullPage = useCallback(() => {
    // The watch page reads the saved position, so flush it before handing over.
    recordWatchProgress({
      videoId,
      positionSeconds: currentTimeRef.current,
      durationSeconds: durationRef.current,
      title,
      flush: true,
    })
    void returnToFullPage(videoRouteHref(video))
  }, [video, videoId, title])

  const previous = adjacentTimedSpeech(speeches, currentTime, -1)
  const next = adjacentTimedSpeech(speeches, currentTime, 1)
  const hasTimedSpeeches = speeches.some((speech) => speech.startSeconds !== null)

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-black text-foreground">
        <div className="flex h-8 shrink-0 items-center gap-1 bg-background px-1.5">
          <PlayerIconButton
            icon={isPlaying ? Pause : Play}
            label={isPlaying ? "Pause video" : "Play video"}
            tooltip={isPlaying ? "Pause" : "Play"}
            tooltipSide="bottom"
            onClick={handlePlayPause}
          />
          <span className="min-w-0 flex-1 truncate text-xs font-medium" title={title}>
            {title}
          </span>
          {isDesktop && (
            <PlayerIconButton
              icon={isOnTop ? Pin : PinOff}
              label={isOnTop ? "Stop keeping on top" : "Keep on top of other windows"}
              tooltip={isOnTop ? "Always on top: on" : "Always on top: off"}
              tooltipSide="bottom"
              active={isOnTop}
              aria-pressed={isOnTop}
              onClick={handleToggleOnTop}
            />
          )}
          <PlayerIconButton
            icon={Maximize2}
            label="Open the full watch page"
            tooltipSide="bottom"
            onClick={handleOpenFullPage}
          />
        </div>

        <div className="relative min-h-0 flex-1">
          <iframe
            ref={setIframeRef}
            src={iframeSrc}
            title={title}
            onLoad={() => startListening(iframeRef.current)}
            className="absolute inset-0 h-full w-full"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        {speeches.length > 0 && (
          <div className="flex shrink-0 items-center gap-1 bg-background p-1">
            {hasTimedSpeeches && (
              <PlayerIconButton
                icon={ChevronLeft}
                label={previous ? `Previous speech: ${previous.label}` : "No earlier speech"}
                disabled={!previous}
                onClick={() => seekToSpeech(previous)}
              />
            )}
            <div className="min-w-0 flex-1">
              <WatchSpeechTimeline
                speeches={speeches}
                currentTime={currentTime}
                duration={duration}
                onSelect={seekToSpeech}
              />
            </div>
            {hasTimedSpeeches && (
              <PlayerIconButton
                icon={ChevronRight}
                label={next ? `Next speech: ${next.label}` : "No later speech"}
                disabled={!next}
                onClick={() => seekToSpeech(next)}
              />
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
