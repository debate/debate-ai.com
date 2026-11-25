/**
 * @fileoverview Compact video links for the rankings who-debated-whom pinned
 * card: rounds matching the focused team (or both teams of a pairing). Renders
 * nothing while loading or when none match. Hosts hand it to
 * `HeadToHeadVideosProvider` from `@debate-ai/rankings/leaderboard`.
 * @module panels/HeadToHeadVideos
 */

"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Film } from "lucide-react"
import { useVideoFeed } from "../hooks/useVideoFeed"
import { competitorPhrases, phraseInText } from "../data/video-query"
import { videoRouteHref } from "../lib/video-route"
import type { DebateStyle, VideoType } from "../types/videos"
import type { HeadToHeadVideosProps } from "@debate-ai/rankings/src/leaderboard/network/HeadToHeadVideosSlot"

/** How many matching rounds to list on the small pinned card. */
const MAX_LINKS = 5

/** Whether `video` involves every phrase group (one group per team). */
export function videoMatchesGroups(
  video: Pick<VideoType, number> | VideoType,
  groups: readonly (readonly string[])[],
): boolean {
  if (groups.length === 0) return true
  const aff = typeof video[9] === "string" ? video[9] : null
  const neg = typeof video[10] === "string" ? video[10] : null
  const title = typeof video[1] === "string" ? video[1] : ""
  const cleaned = groups.map((group) => competitorPhrases([...group]))
  if (cleaned.some((g) => g.length === 0)) return false

  if (aff || neg) {
    const sides = [aff, neg]
    // Each group must hit at least one side; for two groups, prefer opposite sides.
    if (cleaned.length === 2) {
      const [a, b] = cleaned
      const aAff = a!.some((p) => phraseInText(aff, p))
      const aNeg = a!.some((p) => phraseInText(neg, p))
      const bAff = b!.some((p) => phraseInText(aff, p))
      const bNeg = b!.some((p) => phraseInText(neg, p))
      return (aAff && bNeg) || (aNeg && bAff) || (aAff && bAff && aff === neg)
    }
    return cleaned.every((phrases) =>
      phrases.some((phrase) => sides.some((side) => phraseInText(side, phrase))),
    )
  }

  return cleaned.every((phrases) => phrases.some((phrase) => phraseInText(title, phrase)))
}

/** Short label for a round link: tournament · round, else the title. */
function linkLabel(video: VideoType): string {
  const tournament = typeof video[7] === "string" ? video[7].trim() : ""
  const round = typeof video[8] === "string" ? video[8].trim() : ""
  const parts = [tournament, round].filter(Boolean)
  if (parts.length) return parts.join(" · ")
  return video[1] || "Video"
}

/**
 * Lists matching round videos under a who-debated-whom pinned card.
 * Hidden when there are none.
 */
export function HeadToHeadVideos({
  competitors,
  styles,
  requireGroups,
}: HeadToHeadVideosProps) {
  const feed = useVideoFeed({
    source: "round",
    competitors: [...competitors],
    styles: styles.length ? ([...styles] as DebateStyle[]) : null,
    sort: "Recency",
    pageSize: 24,
    enabled: competitors.length > 0,
  })

  const matches = useMemo(() => {
    const rows = feed.videos
    const filtered = requireGroups?.length
      ? rows.filter((video) => videoMatchesGroups(video, requireGroups))
      : rows
    return filtered.slice(0, MAX_LINKS)
  }, [feed.videos, requireGroups])

  if (feed.isLoading) {
    return (
      <p className="mt-2 border-t pt-1.5 text-[10px] text-muted-foreground" aria-busy="true">
        Looking for videos…
      </p>
    )
  }
  if (matches.length === 0) return null

  return (
    <div className="mt-2 border-t pt-1.5">
      <p className="mb-1 flex items-center gap-1 font-medium text-foreground">
        <Film className="h-3 w-3 text-violet-500" aria-hidden />
        Videos
        {feed.total > matches.length && (
          <span className="font-normal text-muted-foreground">· {feed.total}</span>
        )}
      </p>
      <ul className="space-y-0.5">
        {matches.map((video) => (
          <li key={video[0]}>
            <Link
              href={videoRouteHref(video)}
              className="block truncate text-blue-600 hover:underline dark:text-blue-400"
              title={video[1]}
            >
              {linkLabel(video)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
