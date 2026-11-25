/**
 * @fileoverview A school page's videos as one scrolling row across the top
 * banner, newest first, the way the home page shows its latest videos. Each
 * card is the Videos page's own card (`VideoCard`): aff vs neg with their
 * rankings, the tournament and round, the year, what each side ran (the 1AC
 * and 2NR arguments) and the card's badges and actions, without the video's
 * length. The row is
 * drawn twice and drifts left on its own, wrapping at the copy for a
 * seamless loop. Readers can also scroll it by hand (trackpad, touch, shift +
 * wheel) or with the left and right arrow buttons at each end, which step
 * about a screen of cards; hovering or focusing pauses the drift. Readers who
 * prefer reduced motion get a still row with the same scrolling and arrows.
 * Nothing renders until the school has videos.
 * @module panels/ProfileVideosMarquee
 */

"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useVideoFeed } from "../hooks/useVideoFeed"
import { useVideoState } from "../hooks/useVideoState"
import { VideoTeamRankingContext, useVideoTeamRankings } from "../hooks/useVideoTeamRankings"
import { VideoCard } from "../components/videos/card/VideoCard"
import type { VideoType } from "../types/videos"
import type { ProfileVideoSearch } from "@debate-ai/rankings/src/leaderboard/profile/rankingProfileHelpers"

/** How many of the newest videos the row scrolls through. */
export const PROFILE_MARQUEE_VIDEOS = 24

/** Width of one card, padding included, in pixels. */
const CARD_WIDTH = 300

/** Drift speed: one card every 4 seconds. */
const DRIFT_PX_PER_SECOND = CARD_WIDTH / 4

/** How far one arrow click scrolls: most of the visible row, at least one card. */
export function arrowStep(visibleWidth: number): number {
  return Math.max(CARD_WIDTH, Math.round(visibleWidth * 0.8))
}

/**
 * Keeps a scroll offset inside the first copy of the row, so scrolling past
 * either end continues seamlessly into the other copy.
 *
 * @param offset - The scroll offset to wrap.
 * @param loopWidth - Width of one copy of the row.
 */
export function wrapOffset(offset: number, loopWidth: number): number {
  if (loopWidth <= 0) return offset
  return ((offset % loopWidth) + loopWidth) % loopWidth
}

const MARQUEE_CSS = `
.profile-videos-scroller { scrollbar-width: none; }
.profile-videos-scroller::-webkit-scrollbar { display: none; }
`

/** One card, the Videos page's own; the looping copy is inert so it can't be tabbed into. */
function MarqueeCard({ video, actions }: { video: VideoType; actions: MarqueeActions }) {
  return (
    <li className="w-[300px] shrink-0 px-1.5">
      <VideoCard
        video={video}
        showThumbnails={actions.showThumbnails}
        isFavorite={actions.favorites.has(video[0])}
        onToggleFavorite={actions.onToggleFavorite}
        onBadgeClick={actions.onBadgeClick}
        onHideVideo={actions.onHideVideo}
        onUnhideVideo={actions.onUnhideVideo}
        isHidden={actions.hiddenVideos.has(video[0])}
        isTopPick={false}
        showFullDate
        showDuration={false}
      />
    </li>
  )
}

/** The card callbacks and viewer state the row passes to each card. */
interface MarqueeActions {
  showThumbnails: boolean
  favorites: ReadonlySet<string>
  hiddenVideos: ReadonlySet<string>
  onToggleFavorite: (videoId: string) => void
  onBadgeClick: (text: string) => void
  onHideVideo: (videoId: string) => void
  onUnhideVideo: (videoId: string) => void
}

const NO_ACTIONS: MarqueeActions = {
  showThumbnails: true,
  favorites: new Set(),
  hiddenVideos: new Set(),
  onToggleFavorite: () => undefined,
  onBadgeClick: () => undefined,
  onHideVideo: () => undefined,
  onUnhideVideo: () => undefined,
}

/** The row itself, given its videos; split out so it renders in tests. */
export function ProfileVideosMarqueeRow({
  videos,
  label,
  actions = NO_ACTIONS,
}: {
  videos: VideoType[]
  label: string
  actions?: MarqueeActions
}) {
  // Current-season teams' badges show their rank and last names, as on the Videos page.
  const teamRanking = useVideoTeamRankings(videos)
  const scroller = useRef<HTMLDivElement>(null)
  const firstCopy = useRef<HTMLUListElement>(null)
  const paused = useRef(false)

  // Drift left on its own, wrapping at the end of the first copy.
  useEffect(() => {
    const el = scroller.current
    if (!el || videos.length === 0) return
    // Start a pixel in, so scrolling left by hand straight away wraps too.
    if (el.scrollLeft < 1) el.scrollLeft = 1
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduce) return
    let frame = 0
    let last = performance.now()
    let position = el.scrollLeft
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100) / 1000
      last = now
      const loop = firstCopy.current?.offsetWidth ?? 0
      if (!paused.current && loop > 0) {
        // Track a float position: scrollLeft rounds, which would stall slow drifts.
        if (Math.abs(el.scrollLeft - position) > 2) position = el.scrollLeft
        // Kept in [1, loop + 1), where the scroll handler leaves it alone.
        position = wrapOffset(position - 1 + DRIFT_PX_PER_SECOND * dt, loop) + 1
        el.scrollLeft = position
      } else {
        position = el.scrollLeft
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [videos.length])

  // Hand scrolling past either end continues into the other copy.
  const onScroll = useCallback(() => {
    const el = scroller.current
    const loop = firstCopy.current?.offsetWidth ?? 0
    if (!el || loop <= 0) return
    if (el.scrollLeft >= loop + 1) el.scrollLeft -= loop
    else if (el.scrollLeft < 1) el.scrollLeft += loop
  }, [])

  const step = useCallback((direction: -1 | 1) => {
    const el = scroller.current
    if (!el) return
    const loop = firstCopy.current?.offsetWidth ?? 0
    const distance = arrowStep(el.clientWidth) * direction
    // Jump to the matching spot in the other copy first, so the smooth scroll has room.
    if (loop > 0 && direction < 0 && el.scrollLeft + distance < 0) el.scrollLeft += loop
    if (loop > 0 && direction > 0 && el.scrollLeft + distance + el.clientWidth > loop * 2) el.scrollLeft -= loop
    el.scrollBy({ left: distance, behavior: "smooth" })
  }, [])

  if (videos.length === 0) return null
  const pause = () => {
    paused.current = true
  }
  const resume = () => {
    paused.current = false
  }
  const arrowClass =
    "absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-md backdrop-blur transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  return (
    <section
      aria-label={`Latest videos of ${label}`}
      data-profile-videos-marquee
      className="profile-videos relative mt-2 w-full"
      onPointerEnter={pause}
      onPointerLeave={resume}
      onFocus={pause}
      onBlur={resume}
      onTouchStart={pause}
    >
      <style>{MARQUEE_CSS}</style>
      <div
        ref={scroller}
        onScroll={onScroll}
        className="profile-videos-scroller overflow-x-auto [mask-image:linear-gradient(to_right,transparent,#000_4%,#000_96%,transparent)]"
      >
        <VideoTeamRankingContext.Provider value={teamRanking}>
        <div className="profile-videos-track flex w-max items-stretch">
          <ul ref={firstCopy} className="flex">
            {videos.map((video) => (
              <MarqueeCard key={video[0]} video={video} actions={actions} />
            ))}
          </ul>
          <ul className="profile-videos-copy flex" aria-hidden inert>
            {videos.map((video) => (
              <MarqueeCard key={video[0]} video={video} actions={actions} />
            ))}
          </ul>
        </div>
        </VideoTeamRankingContext.Provider>
      </div>
      <button type="button" aria-label="Scroll videos left" onClick={() => step(-1)} className={`${arrowClass} left-1`}>
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <button type="button" aria-label="Scroll videos right" onClick={() => step(1)} className={`${arrowClass} right-1`}>
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
    </section>
  )
}

/** Loads the newest rounds `search` finds and scrolls them. */
export function ProfileVideosMarquee({ search }: { search: ProfileVideoSearch }) {
  const feed = useVideoFeed({
    source: "round",
    competitors: search.competitors,
    styles: search.styles,
    q: "",
    sort: "Recency",
    enabled: search.competitors.length > 0,
  })
  const { state, actions } = useVideoState()
  const rowActions = useMemo<MarqueeActions>(
    () => ({
      showThumbnails: state.showThumbnails,
      favorites: state.favorites,
      hiddenVideos: state.hiddenVideos,
      onToggleFavorite: actions.toggleFavorite,
      onBadgeClick: () => undefined,
      onHideVideo: actions.hideVideo,
      onUnhideVideo: actions.unhideVideo,
    }),
    [state.showThumbnails, state.favorites, state.hiddenVideos, actions],
  )
  return (
    <ProfileVideosMarqueeRow
      videos={feed.videos.slice(0, PROFILE_MARQUEE_VIDEOS)}
      label={search.label}
      actions={rowActions}
    />
  )
}
