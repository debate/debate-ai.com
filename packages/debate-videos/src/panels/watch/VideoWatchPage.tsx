/**
 * @fileoverview The watch page — one video at its own URL, with its
 * transcript beside it and related videos underneath.
 *
 * `/videos/watch/<title-slug>-<videoId>`. This is what the transcript dialog
 * over the grid used to be: the same player, the same synced transcript and
 * the same toolbar controls, but linkable, shareable, indexable, and with
 * room for the sentences to be read rather than squinted at through a modal.
 *
 * ## It is the only player while it is mounted
 *
 * The library's rule is that exactly one YouTube embed exists at a time —
 * two of them fight over playback and over picture-in-picture. So this page
 * does not mount a second player beside the floating one: on mount it claims
 * playback through `setTheaterVideoId`, which stands the floating widget
 * down, and it registers its own iframe as `videoPlayerIframeRef` so
 * `sendYouTubeCommand` (and anything built on it, like the slow-the-spread
 * speed toggle) keeps driving the embed the user is actually watching.
 *
 * Leaving the page reverses both, after writing the current position back to
 * the store — so the floating player resumes mid-sentence instead of
 * restarting, which is the whole point of it being persistent.
 *
 * ## Switching videos navigates
 *
 * Anything on this page that changes the store's active video — clicking a
 * related card, skipping to the next queued video — navigates to that
 * video's watch page rather than silently swapping the embed, so the URL
 * always names what is playing.
 * @module panels/watch/VideoWatchPage
 */

"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertCircle, ArrowLeft, Calendar, Eye } from "lucide-react"

import { WatchToolbar } from "../../components/watch/WatchToolbar"
import { WatchTranscriptPanel } from "../../components/watch/WatchTranscriptPanel"
import { VideoGrid } from "../../components/video-grid/VideoGrid"
import { useDocumentPictureInPicture } from "../../components/video-player/useDocumentPictureInPicture"
import {
  buildEmbedUrl,
  describePlayerError,
  startListening,
  watchUrl,
} from "../../components/video-player/youtubeEmbed"
import { useTranscript } from "../../components/transcript/useTranscript"
import { groupIntoSentences } from "../../components/transcript/transcriptUtils"
import {
  DEBATE_STYLE_LABELS,
  STYLE_COLORS,
  formatVideoDate,
} from "../../components/video-card/videoCardUtils"
import { LecturesSidebarShell } from "../LecturesSidebarShell"
import { useVideoState } from "../../hooks/useVideoState"
import { useVideoMeta } from "../../hooks/useVideoFeed"
import {
  sendYouTubeCommand,
  useVideoPlayerStore,
  videoPlayerIframeRef,
} from "../../state/videoPlayerStore"
import { savePlayerState } from "../../state/videoPlayerPersistence"
import { videoWatchHref } from "../../lib/video-slug"
import type { TopicType, VideoType } from "../../types/videos"

/** How long the permalink control shows its "copied" tick. */
const COPIED_FEEDBACK_MS = 1800

export interface VideoWatchPageProps {
  /** The video this page is about; see {@link VideoType} for the index map. */
  video: VideoType
  /** Videos shown under the player — same tournament, format or category. */
  related?: VideoType[]
  /** Season topics, for the related cards' "T" tooltip button. */
  topics?: TopicType[]
  /** App-owned navigation dock, rendered at the top of the sidebar. */
  dockSlot?: React.ReactNode
  /** App-specific toolbar buttons — see `SlowSpreadButton`. */
  extraControls?: React.ReactNode
}

export function VideoWatchPage({
  video,
  related = [],
  topics,
  dockSlot,
  extraControls,
}: VideoWatchPageProps) {
  const router = useRouter()

  const [
    videoId,
    title,
    date,
    channel,
    viewCount,
    description,
    style,
    tournament,
    roundLevel,
    affTeam,
    negTeam,
    ,
    judgeDecision,
  ] = video

  const styleNumber = typeof style === "number" ? style : undefined
  const categoryLabel = typeof style === "string" ? style : undefined
  const year = useMemo(() => new Date(date).getFullYear(), [date])
  const videoMeta = useMemo(
    () => ({ style: styleNumber, tournament, year, affTeam, negTeam }),
    [styleNumber, tournament, year, affTeam, negTeam],
  )

  const activeVideoId = useVideoPlayerStore((state) => state.activeVideoId)
  const activeVideoTitle = useVideoPlayerStore((state) => state.activeVideoTitle)
  const isPlaying = useVideoPlayerStore((state) => state.isPlaying)
  const playbackRate = useVideoPlayerStore((state) => state.playbackRate)
  const queue = useVideoPlayerStore((state) => state.queue)
  const isInQueue = useVideoPlayerStore((state) => state.queue.some((item) => item.videoId === videoId))
  const setActiveVideo = useVideoPlayerStore((state) => state.setActiveVideo)
  const setTheaterVideoId = useVideoPlayerStore((state) => state.setTheaterVideoId)
  const setIsPlaying = useVideoPlayerStore((state) => state.setIsPlaying)
  const addToQueue = useVideoPlayerStore((state) => state.addToQueue)
  const playNextInQueue = useVideoPlayerStore((state) => state.playNextInQueue)
  const clearActiveVideo = useVideoPlayerStore((state) => state.clearActiveVideo)

  const { state: viewState, actions: viewActions } = useVideoState()
  const { counts, lectureCategories } = useVideoMeta()

  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const videoWrapperRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  /** Latest position reported by the embed — handed back to the popout player on the way out. */
  const currentTimeRef = useRef(0)
  /** The rate still needs applying to this load: a fresh embed always starts at 1x. */
  const pendingPlaybackRate = useRef(false)

  const [currentTime, setCurrentTime] = useState(0)
  /**
   * Second to open the embed at, resolved from the video's saved timestamp
   * once this page has claimed playback. `null` until then: the value can
   * only be read from `localStorage`, so rendering the iframe before it is
   * known would either mismatch the server's markup or reload the embed a
   * frame later.
   *
   * It is tagged with the video it belongs to because moving between two
   * watch pages reuses this component with new props — an untagged number
   * would open the incoming video at the outgoing one's position for the one
   * render before the effect below catches up.
   */
  const [startSeconds, setStartSeconds] = useState<{ videoId: string; seconds: number } | null>(
    null,
  )
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLinkCopied, setIsLinkCopied] = useState(false)
  const [playerError, setPlayerError] = useState<number | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  /** Position a self-inflicted reload (PiP, retry) has to resume from. */
  const [resumeSeconds, setResumeSeconds] = useState<number | null>(null)
  const [lecturesExpanded, setLecturesExpanded] = useState(true)
  /**
   * Whether this browser exposes a clipboard for the permalink control.
   * Resolved in an effect rather than read during render: `navigator` does
   * not exist on the server, and deciding there would render the control
   * only on the client and mismatch the markup on hydration.
   */
  const [canCopyLink, setCanCopyLink] = useState(false)

  const {
    isSupported: isPipSupported,
    isActive: isPipActive,
    toggle: togglePip,
    exit: exitPip,
  } = useDocumentPictureInPicture(videoWrapperRef)

  const { snippets: cues, loading: transcriptLoading } = useTranscript(videoId, true)
  const sentences = useMemo(() => (cues ? groupIntoSentences(cues) : []), [cues])
  const hasTranscript = sentences.length > 0

  // Claim playback from the floating popout player for as long as this page
  // is mounted, and hand it back — with the position — on the way out.
  useEffect(() => {
    // A move between two watch pages keeps this component, so everything
    // tracked about the outgoing video is cleared here rather than relying on
    // an unmount that doesn't happen.
    currentTimeRef.current = 0
    setCurrentTime(0)
    setResumeSeconds(null)
    setPlayerError(null)

    setActiveVideo(videoId, title, videoMeta)
    setTheaterVideoId(videoId)
    // `setActiveVideo` resolves the video's saved timestamp; read it back
    // rather than duplicating that lookup here.
    setStartSeconds({ videoId, seconds: useVideoPlayerStore.getState().startTime })
    return () => {
      const store = useVideoPlayerStore.getState()
      const seconds = currentTimeRef.current
      if (seconds > 0 && store.activeVideoId === videoId) {
        setActiveVideo(videoId, title, videoMeta, seconds)
        savePlayerState({
          videoId,
          title,
          meta: videoMeta,
          isMinimized: store.isMinimized,
          playbackRate: store.playbackRate,
          queue: store.queue,
          savedTime: seconds,
        })
      }
      // Only stand down if this page is still the one holding playback: on a
      // move to another watch page the next one has already claimed it, and
      // clearing here would let the floating player back in behind it.
      if (store.theaterVideoId === videoId) setTheaterVideoId(null)
    }
  }, [videoId, title, videoMeta, setActiveVideo, setTheaterVideoId])

  // Switching the active video is a navigation here: a related card, or the
  // queue advancing, changes the URL rather than the embed behind it.
  useEffect(() => {
    // Read through to the store rather than trusting this render's snapshot:
    // on the first commit it still names whatever was playing before, which
    // would bounce the page straight back to the previous video.
    const store = useVideoPlayerStore.getState()
    if (!store.activeVideoId || store.activeVideoId === videoId) return
    router.push(videoWatchHref(store.activeVideoTitle ?? "", store.activeVideoId))
  }, [activeVideoId, activeVideoTitle, videoId, router])

  // A fresh embed always starts at 1x, so re-apply the chosen rate on first play.
  useEffect(() => {
    pendingPlaybackRate.current = playbackRate !== 1
  }, [videoId, playbackRate, reloadKey])

  // Track playback from the embed's own broadcasts: position for the
  // transcript, play state for the toolbar, errors for the overlay.
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
            setIsPlaying(true)
            if (pendingPlaybackRate.current) {
              pendingPlaybackRate.current = false
              sendYouTubeCommand("setPlaybackRate", [playbackRate])
            }
          } else if (data.info === 2 || data.info === 0) {
            setIsPlaying(false)
          }
        }
        if (data.event === "infoDelivery" && data.info?.errorCode != null) {
          const code = Number(data.info.errorCode)
          if (!Number.isNaN(code)) setPlayerError(code)
        }
        if (data.event === "infoDelivery" && data.info?.currentTime != null) {
          currentTimeRef.current = data.info.currentTime as number
          setCurrentTime(data.info.currentTime as number)
        }
      } catch {
        // ignore non-JSON messages
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [playbackRate, setIsPlaying])

  // Re-send the handshake for a few seconds after every load: YouTube ignores
  // commands and posts no events until it lands, and moving the iframe into a
  // PiP window re-creates it.
  useEffect(() => {
    let attempts = 0
    startListening(iframeRef.current)
    const interval = setInterval(() => {
      startListening(iframeRef.current)
      if (++attempts >= 12) clearInterval(interval)
    }, 400)
    return () => clearInterval(interval)
  }, [videoId, reloadKey, resumeSeconds, isPipActive])

  useEffect(() => {
    setCanCopyLink(Boolean(navigator.clipboard))
  }, [])

  useEffect(() => {
    const handleChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", handleChange)
    return () => document.removeEventListener("fullscreenchange", handleChange)
  }, [])

  const setIframeRef = useCallback((el: HTMLIFrameElement | null) => {
    iframeRef.current = el
    // Claim the shared handle `sendYouTubeCommand` posts to, so the toolbar
    // and the speed toggle drive this embed rather than a torn-down one.
    videoPlayerIframeRef.current = el
  }, [])

  const seekTo = useCallback((seconds: number) => {
    sendYouTubeCommand("seekTo", [seconds, true])
    sendYouTubeCommand("playVideo")
  }, [])

  const handlePlayPause = useCallback(() => {
    sendYouTubeCommand(isPlaying ? "pauseVideo" : "playVideo")
    setIsPlaying(!isPlaying)
  }, [isPlaying, setIsPlaying])

  const handleTogglePip = useCallback(() => {
    setResumeSeconds(currentTimeRef.current)
    void togglePip()
  }, [togglePip])

  const handleToggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined)
      return
    }
    void stageRef.current?.requestFullscreen?.().catch(() => undefined)
  }, [])

  const handleRetry = useCallback(() => {
    setPlayerError(null)
    setResumeSeconds(currentTimeRef.current)
    setReloadKey((key) => key + 1)
  }, [])

  const handleCopyLink = useCallback(() => {
    void navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => {
        setIsLinkCopied(true)
        setTimeout(() => setIsLinkCopied(false), COPIED_FEEDBACK_MS)
      })
      .catch(() => undefined)
  }, [])

  // Leaving for the library hands playback to the floating player; the
  // unmount effect above carries the position across.
  const handlePopOut = useCallback(() => router.push("/videos"), [router])

  const handleClose = useCallback(() => {
    exitPip()
    currentTimeRef.current = 0
    clearActiveVideo()
    router.push("/videos")
  }, [clearActiveVideo, exitPip, router])

  // The library seeds its search box from `?q=` on mount, so a click on a
  // team, tournament or channel here lands on that search rather than on an
  // unfiltered grid.
  const handleBadgeClick = useCallback(
    (text: string) => router.push(`/videos?q=${encodeURIComponent(text)}`),
    [router],
  )

  const resolvedStart = startSeconds?.videoId === videoId ? startSeconds.seconds : null
  const embedStart = resolvedStart === null ? null : (resumeSeconds ?? resolvedStart)
  const iframeSrc =
    embedStart === null
      ? null
      : buildEmbedUrl(videoId, { autoplay: true, controls: true, startSeconds: embedStart })

  const quickLinkCounts = useMemo(
    () =>
      ({
        lectures: counts.lectures,
        policy: counts.byStyle[1] ?? 0,
        ld: counts.byStyle[3] ?? 0,
        pf: counts.byStyle[2] ?? 0,
        college: counts.byStyle[4] ?? 0,
        topPicks: counts.topPicks,
        favorites: viewState.favorites.size,
        statistics: counts.total,
      }) as Record<string, number>,
    [counts, viewState.favorites],
  )

  const styleLabel =
    styleNumber && DEBATE_STYLE_LABELS[styleNumber as keyof typeof DEBATE_STYLE_LABELS]

  return (
    <LecturesSidebarShell
      dockSlot={dockSlot}
      counts={quickLinkCounts}
      lectureCategories={lectureCategories}
      lecturesExpanded={lecturesExpanded}
      onToggleLectures={() => setLecturesExpanded((shown) => !shown)}
    >
      <div className="min-h-screen bg-background p-3 sm:p-6 space-y-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link
            href="/videos"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Video library
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:gap-6 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
          <div ref={stageRef} className="min-w-0 space-y-3 bg-background">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {styleLabel && (
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${STYLE_COLORS[styleNumber!] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {styleLabel}
                  </span>
                )}
                {categoryLabel && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide bg-muted text-muted-foreground">
                    {categoryLabel}
                  </span>
                )}
                {tournament && (
                  <button
                    onClick={() => handleBadgeClick(tournament.replace(/\d+/g, "").trim())}
                    className="text-[11px] font-bold text-purple-600 dark:text-purple-400 [font-variant:small-caps] tracking-wider hover:underline"
                  >
                    {tournament}
                  </button>
                )}
                {roundLevel && (
                  <span className="text-[11px] text-muted-foreground">{roundLevel}</span>
                )}
              </div>

              <WatchToolbar
                isPlaying={isPlaying}
                queue={queue}
                isPipSupported={isPipSupported}
                isPipActive={isPipActive}
                isFullscreen={isFullscreen}
                isTranscriptOpen={isTranscriptOpen}
                hasTranscript={hasTranscript}
                isFavorite={viewState.favorites.has(videoId)}
                isInQueue={isInQueue}
                isLinkCopied={isLinkCopied}
                canCopyLink={canCopyLink}
                youtubeUrl={watchUrl(videoId)}
                extraControls={extraControls}
                onPlayPause={handlePlayPause}
                onPlayNext={playNextInQueue}
                onTogglePip={handleTogglePip}
                onToggleFullscreen={handleToggleFullscreen}
                onToggleTranscript={() => setIsTranscriptOpen((open) => !open)}
                onToggleFavorite={() => viewActions.toggleFavorite(videoId)}
                onAddToQueue={() => addToQueue(videoId, title, videoMeta)}
                onCopyLink={handleCopyLink}
                onPopOut={handlePopOut}
                onClose={handleClose}
              />
            </div>

            <div
              ref={videoWrapperRef}
              className="relative w-full overflow-hidden rounded-lg bg-black"
              style={
                isPipActive
                  ? { position: "absolute", inset: 0, width: "100%", height: "100%" }
                  : { paddingTop: "56.25%" }
              }
            >
              {iframeSrc && (
                <iframe
                  key={reloadKey}
                  ref={setIframeRef}
                  src={iframeSrc}
                  title={title}
                  onLoad={() => startListening(iframeRef.current)}
                  className="absolute inset-0 w-full h-full"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}

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
                      href={watchUrl(videoId, currentTimeRef.current)}
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

            <div className="space-y-2">
              <h1 className="text-lg sm:text-xl font-semibold leading-snug">{title}</h1>

              <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                <button
                  onClick={() => handleBadgeClick(channel)}
                  className="hover:text-foreground transition-colors font-medium"
                >
                  {channel}
                </button>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatVideoDate(date, "full")}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {viewCount.toLocaleString()}
                </span>
                {judgeDecision && <span>Decision {judgeDecision}</span>}
              </div>

              {(affTeam || negTeam) && (
                <div className="flex items-center gap-3 text-xs">
                  {affTeam && (
                    <button
                      onClick={() => handleBadgeClick(affTeam)}
                      className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      AFF {affTeam}
                    </button>
                  )}
                  {negTeam && (
                    <button
                      onClick={() => handleBadgeClick(negTeam)}
                      className="font-semibold text-red-600 dark:text-red-400 hover:underline"
                    >
                      NEG {negTeam}
                    </button>
                  )}
                </div>
              )}

              {description && (
                <p className="text-sm text-muted-foreground whitespace-pre-line max-w-3xl">
                  {description}
                </p>
              )}
            </div>
          </div>

          {isTranscriptOpen && (hasTranscript || transcriptLoading) && (
            <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] flex flex-col min-h-0">
              <WatchTranscriptPanel
                sentences={sentences}
                loading={transcriptLoading}
                currentTime={currentTime}
                onSeek={seekTo}
              />
            </div>
          )}
        </div>

        {related.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Related videos
            </h2>
            <VideoGrid
              videos={related}
              showThumbnails
              topics={topics}
              videoContainerRef={viewState.videoContainerRef}
              favorites={viewState.favorites}
              onToggleFavorite={viewActions.toggleFavorite}
              onBadgeClick={handleBadgeClick}
              onHideVideo={viewActions.hideVideo}
              onUnhideVideo={viewActions.unhideVideo}
              hiddenVideos={viewState.hiddenVideos}
            />
          </section>
        )}
      </div>
    </LecturesSidebarShell>
  )
}
