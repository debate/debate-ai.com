/**
 * @fileoverview The watch page — one video at its own URL, with its
 * transcript beside it, and the related videos and the play queue
 * underneath.
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
 * ## What sits beside the player
 *
 * The right-hand column is a tab strip rather than one panel — YouTube's
 * caption cues, then the long-form documents (the round typed up speech by
 * speech, the AI summary of it), then the analysis videos an editor has tied
 * to this one. Every round — and any video whose AI summary or written
 * analysis goes speech by speech — also gets the round one tab per speech
 * there, with a judge-panel outcome simulator in each, and a speech timeline
 * under the player whose segments seek to — and open — each speech. A round
 * nobody wrote up gets its format's standard speeches, which the reader
 * times with "Mark start" (see `lib/round-formats.ts`). Those arrive as props from the server rather than being
 * fetched here: they are the reason this page is worth indexing, and a
 * crawler never waits for a client fetch.
 *
 * ## Switching videos navigates
 *
 * Anything on this page that changes the store's active video — clicking a
 * related row, picking an entry in the stacked playlist, playing
 * something from the queue panel, skipping to the next queued video —
 * navigates to that video's watch page rather than silently swapping the
 * embed, so the URL always names what is playing.
 * @module panels/watch/VideoWatchPage
 */

"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertCircle, ArrowLeft, Calendar, Eye, ListPlus, Loader2 } from "lucide-react"
import { CommentSection } from "@debate/comments"

import { WatchToolbar } from "../../components/watch/WatchToolbar"
import { WatchSidePanel, type WatchSideTab } from "../../components/watch/WatchSidePanel"
import type { LinkedVideo } from "../../components/watch/WatchAnalysisPanel"
import { VideoListRows } from "../../components/video-grid/VideoListRows"
import { WatchQueuePanel } from "../../components/watch/WatchQueuePanel"
import { WatchSearchBox } from "../../components/watch/WatchSearchBox"
import { WatchStackPlaylist } from "../../components/watch/WatchStackPlaylist"
import { WatchSpeechTimeline } from "../../components/watch/WatchSpeechTimeline"
import type { SpeechFocusRequest } from "../../components/watch/WatchRoundPanel"
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
  TOURNAMENT_COLORS,
  getRoundBadgeColor,
  formatVideoDate,
} from "../../components/video-card/videoCardUtils"
import { cn } from "../../ui/lib/utils"
import { LecturesSidebarShell } from "../LecturesSidebarShell"
import { useVideoState } from "../../hooks/useVideoState"
import { useVideoFeed, useVideoMeta } from "../../hooks/useVideoFeed"
import {
  sendYouTubeCommand,
  useVideoPlayerStore,
  videoPlayerIframeRef,
} from "../../state/videoPlayerStore"
import { savePlayerState } from "../../state/videoPlayerPersistence"
import { recordWatchProgress } from "../../state/videoWatchHistory"
import { videoWatchHref } from "../../lib/video-slug"
import { videoRouteHref } from "../../lib/video-route"
import type { VideoDocument } from "../../lib/video-documents"
import {
  captionText,
  withCaptionTranscripts,
  withSpeechStarts,
  type RoundSpeech,
} from "../../lib/round-speeches"
import { resolveRoundSpeeches } from "../../lib/round-formats"
import type { RoundContext } from "../../lib/speech-outcomes"
import { readSpeechStarts, writeSpeechStart } from "../../state/speechStartMarks"
import { readSpeechSegmentation, writeSpeechSegmentation } from "../../state/speechAiCache"
import { requestSpeechSegmentation } from "../../lib/speech-ai-client"
import {
  FORMAT_LABELS,
  applySpeechSegmentation,
  type SpeechSegmentation,
} from "../../lib/speech-segmentation"
import type { SpeechDetectionControl } from "../../components/watch/WatchRoundPanel"
import type { VideoType } from "../../types/videos"

/** Shared empty default, so an absent list keeps one identity across renders. */
const NO_VIDEOS: VideoType[] = []

/** How many search results the list under the player shows at once. */
const RELATED_SEARCH_PAGE_SIZE = 40

/** How long the permalink control shows its "copied" tick. */
const COPIED_FEEDBACK_MS = 1800

export interface VideoWatchPageProps {
  /** The video this page is about; see {@link VideoType} for the index map. */
  video: VideoType
  /** Videos shown under the player — same tournament, format or category. */
  related?: VideoType[]
  /**
   * Long-form documents for this video — the speech-by-speech transcript, the
   * AI summary, the written analysis. Each becomes a tab beside the player.
   */
  documents?: VideoDocument[]
  /** Videos an editor tied to this one; they fill the "Analysis" tab. */
  links?: LinkedVideo[]
  /**
   * Every member of the stacked playlist this video belongs to — the round
   * and its analysis, the parts of a split upload — in stack order, this
   * video included. Shown as a playlist under the player when it holds two
   * or more.
   */
  stack?: VideoType[]
  /** App-owned navigation dock, rendered at the top of the sidebar. */
  dockSlot?: React.ReactNode
  /** App-specific toolbar buttons — see `SlowSpreadButton`. */
  extraControls?: React.ReactNode
  /**
   * App-supplied tabs for the column beside the player, shown first — e.g. a
   * featured round's speech docs. See {@link WatchSideTab}.
   */
  sideTabs?: WatchSideTab[]
}

export function VideoWatchPage({
  video,
  related: relatedVideos = NO_VIDEOS,
  documents = [],
  links = [],
  stack = NO_VIDEOS,
  dockSlot,
  extraControls,
  sideTabs,
}: VideoWatchPageProps) {
  const router = useRouter()

  // The playlist already lists its members; the related rows need not repeat them.
  const related = useMemo(() => {
    const inStack = new Set(stack.map((member) => member[0]))
    return inStack.size > 1
      ? relatedVideos.filter((candidate) => !inStack.has(candidate[0]))
      : relatedVideos
  }, [relatedVideos, stack])

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
    affWin,
    judgeDecision,
    arg1AC,
    arg2NR,
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

  // The search box above the related videos swaps the list under the player
  // for the library's matches — in place, with no navigation, so the video
  // above keeps playing while the reader lines up what to watch next.
  const [relatedQuery, setRelatedQuery] = useState("")
  const searchFeed = useVideoFeed({
    source: "all",
    q: relatedQuery,
    pageSize: RELATED_SEARCH_PAGE_SIZE,
    enabled: relatedQuery !== "",
  })
  const searchResults = useMemo(
    () => searchFeed.videos.filter((candidate) => candidate[0] !== videoId),
    [searchFeed.videos, videoId],
  )
  const listedVideos = relatedQuery ? searchResults : related
  const unqueuedListed = useMemo(() => {
    const queued = new Set(queue.map((item) => item.videoId))
    return listedVideos.filter((candidate) => !queued.has(candidate[0]))
  }, [listedVideos, queue])

  // Every listed video not already queued, in the list's order — a search
  // turned into a playlist in one click.
  const queueAllListed = useCallback(() => {
    for (const candidate of unqueuedListed) {
      const [id, candidateTitle, candidateDate, , , , candidateStyle, candidateTournament, , aff, neg] =
        candidate
      addToQueue(id, candidateTitle, {
        style: typeof candidateStyle === "number" ? candidateStyle : undefined,
        tournament: candidateTournament,
        year: new Date(candidateDate).getFullYear(),
        affTeam: aff,
        negTeam: neg,
      })
    }
  }, [unqueuedListed, addToQueue])

  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const videoWrapperRef = useRef<HTMLDivElement | null>(null)
  /** Latest position reported by the embed — handed back to the popout player on the way out. */
  const currentTimeRef = useRef(0)
  /** The video's length as the embed reports it, for the watch history's percentage. */
  const durationRef = useRef(0)
  /** The rate still needs applying to this load: a fresh embed always starts at 1x. */
  const pendingPlaybackRate = useRef(false)

  const [currentTime, setCurrentTime] = useState(0)
  /** The video's length, for the speech timeline's proportions; 0 until the embed reports it. */
  const [duration, setDuration] = useState(0)
  /** The last speech picked on the timeline, for the side panel to open. */
  const [focusSpeech, setFocusSpeech] = useState<SpeechFocusRequest | null>(null)
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
  /**
   * Whether the column beside the player has anything in it. Captions arrive
   * after the first paint, so this stays true while they load and the page
   * widens only once it is settled that there is nothing to show.
   */
  /** The round's speeches as written up, or its format's standard order — empty for a lecture. */
  const baseSpeeches = useMemo(() => resolveRoundSpeeches(documents, style), [documents, style])
  /** Speech starts the reader marked in this browser, by speech key. */
  const [speechMarks, setSpeechMarks] = useState<Record<string, number>>({})
  useEffect(() => {
    setSpeechMarks(readSpeechStarts(videoId))
  }, [videoId])
  const handleMarkStart = useCallback(
    (speechKey: string, seconds: number | null) => {
      writeSpeechStart(videoId, speechKey, seconds)
      setSpeechMarks(readSpeechStarts(videoId))
    },
    [videoId],
  )
  const markedKeys = useMemo(() => new Set(Object.keys(speechMarks)), [speechMarks])
  /** The speeches the AI found in the captions, kept in this browser per video. */
  const [segmentation, setSegmentation] = useState<SpeechSegmentation | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [detectError, setDetectError] = useState<string | null>(null)
  const detectVideoRef = useRef(videoId)
  useEffect(() => {
    detectVideoRef.current = videoId
    setSegmentation(readSpeechSegmentation(videoId))
    setDetecting(false)
    setDetectError(null)
  }, [videoId])
  /**
   * The round speech by speech: the AI's detected timing laid over what was
   * written, then the reader's own marks (which win), then each untyped
   * speech given the captions spoken during it.
   */
  const speeches = useMemo(
    () =>
      withCaptionTranscripts(
        withSpeechStarts(applySpeechSegmentation(baseSpeeches, segmentation), speechMarks),
        sentences,
      ),
    [baseSpeeches, segmentation, speechMarks, sentences],
  )
  const roundTranscript = useMemo(
    () => (baseSpeeches.length > 0 ? captionText(sentences) : ""),
    [baseSpeeches.length, sentences],
  )
  const handleDetectSpeeches = useCallback(async () => {
    if (sentences.length === 0) return
    const forVideo = videoId
    setDetecting(true)
    setDetectError(null)
    try {
      const result = await requestSpeechSegmentation({
        captions: sentences,
        videoTitle: title,
        formatHint:
          styleNumber !== undefined ? DEBATE_STYLE_LABELS[styleNumber as keyof typeof DEBATE_STYLE_LABELS] : undefined,
        aff: affTeam ?? undefined,
        neg: negTeam ?? undefined,
      })
      if (detectVideoRef.current !== forVideo) return
      writeSpeechSegmentation(forVideo, result)
      setSegmentation(result)
    } catch (error) {
      if (detectVideoRef.current !== forVideo) return
      setDetectError(error instanceof Error ? error.message : "Speech detection failed.")
    } finally {
      if (detectVideoRef.current === forVideo) setDetecting(false)
    }
  }, [sentences, videoId, title, styleNumber, affTeam, negTeam])
  const handleClearDetected = useCallback(() => {
    writeSpeechSegmentation(videoId, null)
    setSegmentation(null)
  }, [videoId])
  const speechDetection = useMemo<SpeechDetectionControl | undefined>(
    () =>
      baseSpeeches.length > 0 || segmentation
        ? {
            onDetect: () => void handleDetectSpeeches(),
            onClear: segmentation ? handleClearDetected : undefined,
            running: detecting,
            error: detectError,
            result: segmentation
              ? `${FORMAT_LABELS[segmentation.format]} · ${segmentation.speeches.length} speech${segmentation.speeches.length === 1 ? "" : "es"} found`
              : null,
            available: sentences.length > 0,
          }
        : undefined,
    [baseSpeeches.length, segmentation, handleDetectSpeeches, handleClearDetected, detecting, detectError, sentences.length],
  )
  const roundContext = useMemo<RoundContext>(
    () => ({
      format: styleNumber !== undefined ? DEBATE_STYLE_LABELS[styleNumber as keyof typeof DEBATE_STYLE_LABELS] : undefined,
      tournament,
      roundLevel,
      aff: affTeam,
      neg: negTeam,
      decision: judgeDecision,
    }),
    [styleNumber, tournament, roundLevel, affTeam, negTeam, judgeDecision],
  )

  const hasSidePanel =
    (sideTabs?.length ?? 0) > 0 ||
    hasTranscript ||
    transcriptLoading ||
    speeches.length > 0 ||
    documents.some((document) => (document.body ?? "").trim().length > 0) ||
    links.length > 0

  // Claim playback from the floating popout player for as long as this page
  // is mounted, and hand it back — with the position — on the way out.
  useEffect(() => {
    // A move between two watch pages keeps this component, so everything
    // tracked about the outgoing video is cleared here rather than relying on
    // an unmount that doesn't happen.
    currentTimeRef.current = 0
    durationRef.current = 0
    setCurrentTime(0)
    setDuration(0)
    setFocusSpeech(null)
    setResumeSeconds(null)
    setPlayerError(null)

    setActiveVideo(videoId, title, videoMeta)
    setTheaterVideoId(videoId)
    // `setActiveVideo` resolves the video's saved timestamp; read it back
    // rather than duplicating that lookup here. Seed the tracked position
    // with it too: until the embed's first `infoDelivery` broadcast arrives,
    // this is the only position known, and `handleTogglePip` reads this same
    // ref with no fallback — popping into PiP in that window should reopen
    // at the video's actual second, not a hard 0.
    const resolvedStartSeconds = useVideoPlayerStore.getState().startTime
    currentTimeRef.current = resolvedStartSeconds
    setStartSeconds({ videoId, seconds: resolvedStartSeconds })
    return () => {
      const store = useVideoPlayerStore.getState()
      const seconds = currentTimeRef.current
      // Leaving the page is the last chance to record how far this got — the
      // next position report belongs to whatever plays next.
      recordWatchProgress({
        videoId,
        positionSeconds: seconds,
        durationSeconds: durationRef.current,
        title,
        flush: true,
      })
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

  // Switching the active video is a navigation here: a related row, or the
  // queue advancing, changes the URL rather than the embed behind it.
  useEffect(() => {
    // Read through to the store rather than trusting this render's snapshot:
    // on the first commit it still names whatever was playing before, which
    // would bounce the page straight back to the previous video.
    const store = useVideoPlayerStore.getState()
    if (!store.activeVideoId || store.activeVideoId === videoId) return
    // A related row is the usual way this fires, and those rows carry the
    // season, tournament and teams the canonical address is built from — so
    // that case navigates straight to it. The queue can also hold a video
    // this page has never seen, and the store keeps only an id and a title;
    // that falls back to the flat `/videos/watch/` address, which exists for
    // exactly this and redirects to the canonical one on arrival.
    const next = [...related, ...searchResults].find(
      (candidate) => candidate[0] === store.activeVideoId,
    )
    router.push(
      next
        ? videoRouteHref(next)
        : videoWatchHref(store.activeVideoTitle ?? ""),
    )
  }, [activeVideoId, activeVideoTitle, videoId, related, searchResults, router])

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
            recordWatchProgress({
              videoId,
              positionSeconds:
                data.info === 0
                  ? durationRef.current || currentTimeRef.current
                  : currentTimeRef.current,
              durationSeconds: durationRef.current,
              title,
              // Only "ended" proves the video was watched through; a pause
              // just flushes whatever position it stopped at.
              completed: data.info === 0,
              flush: true,
            })
          }
        }
        if (data.event === "infoDelivery" && data.info?.errorCode != null) {
          const code = Number(data.info.errorCode)
          if (!Number.isNaN(code)) setPlayerError(code)
        }
        if (data.event === "infoDelivery" && data.info?.duration != null) {
          const duration = Number(data.info.duration)
          if (Number.isFinite(duration) && duration > 0) {
            durationRef.current = duration
            setDuration(duration)
          }
        }
        if (data.event === "infoDelivery" && data.info?.currentTime != null) {
          currentTimeRef.current = data.info.currentTime as number
          setCurrentTime(data.info.currentTime as number)
          // Throttled in the store; see `state/videoWatchHistory.ts`.
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
  }, [playbackRate, setIsPlaying, videoId, title])

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

  /** A timeline segment: play from that speech and open it beside the player. */
  const handleSpeechSelect = useCallback(
    (speech: RoundSpeech) => {
      if (speech.startSeconds !== null) seekTo(speech.startSeconds)
      setIsTranscriptOpen(true)
      setFocusSpeech((previous) => ({ key: speech.key, seq: (previous?.seq ?? 0) + 1 }))
    },
    [seekTo],
  )

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
    // Fullscreen the video wrapper alone (the same element PiP hands off
    // from), not the whole left stage — a viewer asking for fullscreen wants
    // the video, not the title/description column beside it.
    void videoWrapperRef.current?.requestFullscreen?.().catch(() => undefined)
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
          <div className="min-w-0 space-y-3 bg-background">
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
                    className={cn(
                      "text-sm font-bold backdrop-blur-md border px-2 py-1 rounded [font-variant:small-caps] tracking-wider shadow-lg",
                      styleNumber && TOURNAMENT_COLORS[styleNumber]
                        ? TOURNAMENT_COLORS[styleNumber]
                        : "text-purple-300 bg-purple-900/80 border-purple-400/90",
                    )}
                  >
                    {tournament}
                  </button>
                )}
                {year && (
                  <span className="text-sm font-bold text-orange-300 backdrop-blur-md bg-orange-900/80 border border-orange-400/90 px-2 py-1 rounded shadow-lg">
                    '{String(year).slice(-2)}
                  </span>
                )}
                {roundLevel && !/\d/.test(roundLevel) && (
                  <>
                    {(roundLevel.toLowerCase().trim() === "finals" ||
                      roundLevel.toLowerCase().trim() === "final") && (
                      <span className="text-base">🏆</span>
                    )}
                    <span
                      className={cn(
                        "text-sm font-semibold px-2 py-1 rounded border backdrop-blur-md shadow-lg",
                        getRoundBadgeColor(roundLevel),
                      )}
                    >
                      {roundLevel}
                    </span>
                  </>
                )}
                {/* The two teams sit right after the level, in the same row as
                    the round's other badges: aff blue, neg red, the winner
                    ringed in gold. */}
                {affTeam && (
                  <button
                    onClick={() => handleBadgeClick(affTeam)}
                    title={`Affirmative: ${affTeam}`}
                    className={cn(
                      "text-sm font-bold backdrop-blur-md px-2 py-1 rounded",
                      affWin === true
                        ? "border-2 border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)] text-blue-100 bg-blue-900/80"
                        : "border border-blue-400/90 shadow-lg text-blue-300 bg-blue-900/80",
                    )}
                  >
                    {affTeam}
                  </button>
                )}
                {negTeam && (
                  <button
                    onClick={() => handleBadgeClick(negTeam)}
                    title={`Negative: ${negTeam}`}
                    className={cn(
                      "text-sm font-bold backdrop-blur-md px-2 py-1 rounded",
                      affWin === false
                        ? "border-2 border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)] text-red-100 bg-red-900/80"
                        : "border border-red-400/90 shadow-lg text-red-300 bg-red-900/80",
                    )}
                  >
                    {negTeam}
                  </button>
                )}
              </div>

              <WatchToolbar
                isPlaying={isPlaying}
                queue={queue}
                isPipSupported={isPipSupported}
                isPipActive={isPipActive}
                isFullscreen={isFullscreen}
                isTranscriptOpen={isTranscriptOpen}
                hasTranscript={hasSidePanel}
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

            {speeches.length > 0 && (
              <WatchSpeechTimeline
                speeches={speeches}
                currentTime={currentTime}
                duration={duration}
                onSelect={handleSpeechSelect}
              />
            )}

            <WatchStackPlaylist current={video} stack={stack} />

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

              {(arg1AC || arg2NR) && (
                <div className="flex flex-wrap items-start gap-2">
                  {arg1AC && (
                    <span className="text-xs font-medium text-blue-100 backdrop-blur-md bg-blue-950/90 px-2 py-0.5 rounded border border-blue-800/50 shadow-sm leading-tight">
                      1AC: {arg1AC}
                    </span>
                  )}
                  {arg2NR && (
                    <span className="text-xs font-medium text-red-100 backdrop-blur-md bg-red-950/90 px-2 py-0.5 rounded border border-red-800/50 shadow-sm leading-tight">
                      2NR: {arg2NR}
                    </span>
                  )}
                </div>
              )}

              {description && (
                <p className="text-sm text-muted-foreground whitespace-pre-line max-w-3xl">
                  {description}
                </p>
              )}
            </div>

            {/* The discussion, under the video's own metadata and above
                everything else on the page. YouTube puts it here for a reason:
                a viewer has just finished (or scrubbed past) the round, and
                the questions that round raised are what they want to say
                something about. A comment thread higher up would compete with
                the player; below "Related videos" it would compete with the
                next video, and nobody scrolls that far. */}
            <div className="border-t border-border pt-5">
              <CommentSection resourceType="video" resourceId={videoId} />
            </div>
          </div>

          {/* A set height, so every tab scrolls inside the column instead of
              stretching the page: shorter under the player on a phone, as
              tall as the screen allows (up to 720px) beside it. */}
          {isTranscriptOpen && hasSidePanel && (
            <div className="h-[480px] lg:sticky lg:top-6 lg:h-[min(720px,calc(100vh-3rem))] flex flex-col min-h-0">
              <WatchSidePanel
                sentences={sentences}
                captionsLoading={transcriptLoading}
                documents={documents}
                links={links}
                currentTime={currentTime}
                onSeek={seekTo}
                focusSpeech={focusSpeech}
                videoId={videoId}
                videoTitle={title}
                speeches={speeches}
                round={roundContext}
                roundTranscript={roundTranscript}
                onMarkStart={handleMarkStart}
                markedKeys={markedKeys}
                speechDetection={speechDetection}
                extraTabs={sideTabs}
              />
            </div>
          )}
        </div>

        {/* Above the related videos, and it drives them: a search replaces
            the list under the player with the library's matches, without
            leaving the page, so the video above keeps playing while the
            reader picks — and queues — what comes next. Clearing it brings
            the related videos back. */}
        <WatchSearchBox
          onSearch={setRelatedQuery}
          onClear={() => setRelatedQuery("")}
          activeQuery={relatedQuery}
          className="max-w-2xl"
        />

        {(relatedQuery || related.length > 0) && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {relatedQuery ? `Results for “${relatedQuery}”` : "Related videos"}
              </h2>
              {relatedQuery && searchFeed.isLoading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Searching" />
              )}
              {unqueuedListed.length > 0 && (
                <button
                  type="button"
                  onClick={queueAllListed}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                >
                  <ListPlus className="h-3.5 w-3.5" />
                  Queue all ({unqueuedListed.length})
                </button>
              )}
            </div>
            {/* Rows rather than the card grid: a related list is a handful of
                videos to pick the next one from, and rows put their dates and
                view counts in one sortable column each — the grid's cards
                spread the same fields across a wall of thumbnails. Opening
                sorted newest-first, since nothing ranks this list otherwise;
                the Date header flips it, and the other columns re-sort it.
                The queue rides alongside: this is the page where videos get
                lined up, and the floating player that normally shows "Up
                next" is stood down while it is open. */}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
              {listedVideos.length > 0 ? (
                <VideoListRows
                  videos={listedVideos}
                  videoContainerRef={viewState.videoContainerRef}
                  favorites={viewState.favorites}
                  onToggleFavorite={viewActions.toggleFavorite}
                  onHideVideo={viewActions.hideVideo}
                  onUnhideVideo={viewActions.unhideVideo}
                  hiddenVideos={viewState.hiddenVideos}
                  grouped={false}
                  defaultSort={{ column: "date", direction: "desc" }}
                  onSearch={setRelatedQuery}
                />
              ) : (
                <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  {searchFeed.isLoading
                    ? "Searching…"
                    : searchFeed.errorMessage || `No videos match “${relatedQuery}”.`}
                </p>
              )}
              <WatchQueuePanel className="lg:sticky lg:top-6" />
            </div>
          </section>
        )}
      </div>
    </LecturesSidebarShell>
  )
}
