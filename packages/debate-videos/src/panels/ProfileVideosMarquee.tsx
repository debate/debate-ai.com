/**
 * @fileoverview A school page's videos as one scrolling row across the top
 * banner, newest first, the way the home page shows its latest videos. Each
 * card is the thumbnail and title, linking to the watch page. The row is
 * drawn twice and slid left by half its width for a seamless loop; hovering
 * or focusing pauses it, and readers who prefer reduced motion get a still
 * row they can scroll by hand. Nothing renders until the school has videos.
 * @module panels/ProfileVideosMarquee
 */

"use client"

import type { CSSProperties } from "react"
import Link from "next/link"
import { useVideoFeed } from "../hooks/useVideoFeed"
import { videoRouteHref } from "../lib/video-route"
import type { VideoType } from "../types/videos"
import type { ProfileVideoSearch } from "@debate-ai/rankings/src/leaderboard/profile/rankingProfileHelpers"

/** How many of the newest videos the row scrolls through. */
export const PROFILE_MARQUEE_VIDEOS = 24

/** Seconds per video for one full loop, so the speed stays even whatever the count. */
const SECONDS_PER_VIDEO = 4

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

function MarqueeCard({ video, hidden }: { video: VideoType; hidden?: boolean }) {
  const [id, title, date] = video
  return (
    <li className="w-[200px] shrink-0 px-1.5">
      <Link
        href={videoRouteHref(video)}
        tabIndex={hidden ? -1 : undefined}
        title={title}
        className="flex h-full flex-col gap-1.5 rounded-lg border border-border bg-card p-2 transition-colors hover:bg-accent"
      >
        <img
          src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`}
          alt=""
          loading="lazy"
          decoding="async"
          className="aspect-video w-full rounded-md border border-border bg-muted object-cover"
        />
        <span className="line-clamp-2 text-xs font-medium leading-snug text-foreground">{title}</span>
        {date && <span className="text-[10px] tabular-nums text-muted-foreground">{date.slice(0, 10)}</span>}
      </Link>
    </li>
  )
}

/** The row itself, given its videos; split out so it renders in tests. */
export function ProfileVideosMarqueeRow({ videos, label }: { videos: VideoType[]; label: string }) {
  if (videos.length === 0) return null
  const style = { "--profile-videos-duration": `${videos.length * SECONDS_PER_VIDEO}s` } as CSSProperties
  return (
    <section
      aria-label={`Latest videos of ${label}`}
      data-profile-videos-marquee
      className="profile-videos relative mt-2 w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_4%,#000_96%,transparent)]"
    >
      <style>{MARQUEE_CSS}</style>
      <div className="profile-videos-track flex w-max" style={style}>
        <ul className="flex">
          {videos.map((video) => (
            <MarqueeCard key={video[0]} video={video} />
          ))}
        </ul>
        <ul className="profile-videos-copy flex" aria-hidden>
          {videos.map((video) => (
            <MarqueeCard key={video[0]} video={video} hidden />
          ))}
        </ul>
      </div>
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
  return <ProfileVideosMarqueeRow videos={feed.videos.slice(0, PROFILE_MARQUEE_VIDEOS)} label={search.label} />
}
