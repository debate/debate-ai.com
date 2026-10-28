/**
 * @fileoverview Site-wide items for the News tab: the newest rounds, the
 * newest caselist files and the latest forum activity, shaped into the News
 * Stream's `NewsItem`. Pure builders here; `useSiteNews` fetches the inputs.
 *
 * @module lib/news/site-news
 */

import type { NewsItem } from "@debate-ai/community/src/lib/news-stream"
import type { VideoType } from "@debate-ai/types"
import { formatRoundLevel, standardizeRoundLevel } from "@debate-ai/videos/src/data/round-level"
import { videoRouteHref } from "@debate-ai/videos/src/lib/video-route"
import { schoolHref } from "@debate-ai/rankings-adapter/src/leaderboard/profile/rankingProfileHelpers"
import type { ForumThreadSummary } from "../forums/types"

/** A caselist document as `/api/caselist-documents` returns it (the fields read here). */
export interface SiteNewsFile {
  id: number
  caselistLabel: string
  school: string
  team: string | null
  side: string | null
  fileName: string
  cardCount: number
  /** Epoch seconds. */
  ingestedAt: number
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`
}

/** One item per round video, titled by its matchup when both teams are known. */
export function buildRoundNews(videos: readonly VideoType[]): NewsItem[] {
  return videos.map((video) => {
    const aff = video[9]?.trim()
    const neg = video[10]?.trim()
    const published = Date.parse(video[2] ?? "")
    return {
      id: `round-${video[0]}`,
      category: "rounds" as const,
      title: aff && neg ? `New round: ${aff} vs ${neg}` : `New round: ${video[1]}`,
      body: [video[7], video[8] ? formatRoundLevel(standardizeRoundLevel(video[8])) : null].filter(Boolean).join(" · "),
      timestamp: Number.isFinite(published) ? published : 0,
      href: videoRouteHref(video),
    }
  })
}

/** One item per newly ingested caselist file. */
export function buildFileNews(files: readonly SiteNewsFile[]): NewsItem[] {
  return files.map((file) => ({
    id: `file-${file.id}`,
    category: "files" as const,
    title: `New file: ${file.fileName}`,
    body: [[file.school, file.team].filter(Boolean).join(" "), file.caselistLabel, plural(file.cardCount, "card"), file.side]
      .filter(Boolean)
      .join(" · "),
    timestamp: file.ingestedAt * 1000,
    href: schoolHref(file.school),
  }))
}

/**
 * One item per forum thread: "New reply in …" when it has been replied to
 * since it was opened, else "New thread: …". The id carries the last
 * activity time, so a fresh reply shows up as a new, unread item.
 */
export function buildForumNews(threads: readonly ForumThreadSummary[]): NewsItem[] {
  return threads.map((thread) => {
    const replied = thread.replyCount > 0 && thread.lastActivityAt > thread.createdAt
    return {
      id: `forum-${thread.id}-${thread.lastActivityAt}`,
      category: "forums" as const,
      title: replied ? `New reply in "${thread.title}"` : `New thread: ${thread.title}`,
      body: replied ? `${thread.replyCount} ${thread.replyCount === 1 ? "reply" : "replies"} · started by ${thread.author.name}` : thread.excerpt,
      timestamp: thread.lastActivityAt * 1000,
      href: `/practice/forums/${encodeURIComponent(thread.id)}`,
    }
  })
}
