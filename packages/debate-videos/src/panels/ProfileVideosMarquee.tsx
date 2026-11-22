/**
 * @fileoverview A school page's videos as one scrolling row across the top
 * banner, newest first, the way the home page shows its latest videos. Each
 * item is the Videos page's own card (`VideoCard`): aff vs neg with their
 * rankings, the tournament and round, the year, what each side ran (the 1AC
 * and 2NR arguments) and the card's badges and actions. The row is
 * drawn twice and slid left by half its width for a seamless loop; hovering
 * or focusing pauses it, and readers who prefer reduced motion get a still
 * row they can scroll by hand. Nothing renders until the school has videos.
 * @module panels/ProfileVideosMarquee
 */

"use client"

import { useMemo, type CSSProperties } from "react"
import { useVideoFeed } from "../hooks/useVideoFeed"
import { useVideoState } from "../hooks/useVideoState"
import { VideoTeamRankingContext, useVideoTeamRankings } from "../hooks/useVideoTeamRankings"
import { VideoCard } from "../components/videos/card/VideoCard"
import type { VideoType } from "../types/videos"
import type { ProfileVideoSearch } from "@debate-ai/rankings/src/leaderboard/profile/rankingProfileHelpers"

/** How many of the newest videos the row scrolls through. */
export const PROFILE_MARQUEE_VIDEOS = 24

/** Seconds per video for one full loop, so the speed stays even whatever the count. */
const SECONDS_PER_VIDEO = 6

const MARQUEE_CSS = `
.profile-videos-track { animation: profile-videos-scroll var(--profile-videos-duration, 80s) linear infinite; }
.profile-videos:hover .profile-videos-track, .profile-videos:focus-within .profile-videos-track { animation-play-state: paused; }
@keyframes profile-videos-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) {
  .profile-videos { overflow-x: auto; }
  .profile-videos-track { animation: none; }
  .profile-videos-copy { display: none; }
}
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
  if (videos.length === 0) return null
  const style = { "--profile-videos-duration": `${videos.length * SECONDS_PER_VIDEO}s` } as CSSProperties
  return (
    <section
      aria-label={`Latest videos of ${label}`}
      data-profile-videos-marquee
      className="profile-videos relative mt-2 w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_4%,#000_96%,transparent)]"
    >
      <style>{MARQUEE_CSS}</style>
      <VideoTeamRankingContext.Provider value={teamRanking}>
        <div className="profile-videos-track flex w-max items-stretch" style={style}>
          <ul className="flex">
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
