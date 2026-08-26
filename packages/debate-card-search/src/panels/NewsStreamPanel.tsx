/**
 * @fileoverview News Stream panel — a unified activity feed of product
 * updates and community announcements, built from `state/newsStream.ts`'s
 * `buildNewsFeed` (hand-maintained product updates plus every announced
 * Daily Best Card winner and Contributor Awards standings).
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing, matching every other
 * panel in this package (e.g. `DailyBestCardPanel.tsx`). Also subscribes to
 * the `storage` event (`isNewsStreamLiveUpdateStorageEvent`) so a new
 * announcement, or a read/like made in another tab, refreshes this feed
 * without a manual reload — the same cross-tab live-update mechanism
 * `DailyBestCardPanel.tsx` uses.
 *
 * @module panels/NewsStreamPanel
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import { Bell, Heart, Megaphone, Sparkles, Trophy } from "lucide-react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Card, CardContent } from "debate-ui/src/primitives/card"
import { cn } from "debate-ui/src/lib/utils"
import {
  buildNewsFeed,
  isNewsItemLiked,
  isNewsItemRead,
  markNewsItemRead,
  toggleNewsItemLiked,
} from "../state/newsStream"
import { NEWS_CATEGORY_LABELS, type NewsCategory, type NewsItem } from "../lib/news-stream"
import { isNewsStreamLiveUpdateStorageEvent } from "../state/live-update"

const CATEGORY_ICON: Record<NewsCategory, typeof Bell> = {
  product: Sparkles,
  "daily-best-card": Trophy,
  awards: Trophy,
  community: Megaphone,
}

const FILTERS: { value: NewsCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "product", label: NEWS_CATEGORY_LABELS.product },
  { value: "daily-best-card", label: NEWS_CATEGORY_LABELS["daily-best-card"] },
  { value: "awards", label: NEWS_CATEGORY_LABELS.awards },
  { value: "community", label: NEWS_CATEGORY_LABELS.community },
]

function relativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 30) return `${diffDays} days ago`
  const diffMonths = Math.round(diffDays / 30)
  return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`
}

function NewsItemRow({
  item,
  read,
  liked,
  onRead,
  onToggleLike,
}: {
  item: NewsItem
  read: boolean
  liked: boolean
  onRead: () => void
  onToggleLike: () => void
}) {
  const Icon = CATEGORY_ICON[item.category]
  return (
    <Card
      className={cn("transition-colors", !read && "border-primary/40 bg-primary/[0.03]")}
      onMouseEnter={onRead}
    >
      <CardContent className="flex items-start gap-3 py-4">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{item.title}</span>
            <Badge variant="outline" className="text-[10px]">
              {NEWS_CATEGORY_LABELS[item.category]}
            </Badge>
            {!read && <Badge className="text-[10px]">New</Badge>}
          </div>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{item.body}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{relativeTime(item.timestamp)}</span>
            {item.href && (
              <a href={item.href} className="font-medium text-foreground hover:underline">
                View →
              </a>
            )}
            <button
              type="button"
              onClick={onToggleLike}
              className={cn(
                "flex items-center gap-1 hover:text-foreground",
                liked && "text-rose-500 hover:text-rose-500",
              )}
              aria-pressed={liked}
            >
              <Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} />
              {liked ? "Liked" : "Like"}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Renders the News Stream: every product update and community announcement,
 * newest first, filterable by category, with per-viewer read/like state.
 */
export function NewsStreamPanel() {
  const [items, setItems] = useState<NewsItem[] | null>(null)
  const [filter, setFilter] = useState<NewsCategory | "all">("all")
  // Bumped on every read/like toggle to re-derive the read/liked maps below
  // without re-sorting the feed itself.
  const [viewerTick, setViewerTick] = useState(0)

  useEffect(() => {
    setItems(buildNewsFeed())
  }, [])

  /**
   * Cross-tab live update: rebuild the feed and bump `viewerTick` whenever
   * another tab announces a Daily Best Card/Contributor Awards winner, or
   * toggles read/like state on a news item. A `storage` event never fires
   * in the tab that made the write, only in other tabs.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isNewsStreamLiveUpdateStorageEvent(event)) return
      setItems(buildNewsFeed())
      setViewerTick((t) => t + 1)
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const visible = useMemo(
    () => (items ?? []).filter((item) => filter === "all" || item.category === filter),
    [items, filter],
  )

  const handleRead = (id: string) => {
    if (isNewsItemRead(id)) return
    markNewsItemRead(id)
    setViewerTick((t) => t + 1)
  }

  const handleToggleLike = (id: string) => {
    toggleNewsItemLiked(id)
    setViewerTick((t) => t + 1)
  }

  if (items === null) {
    return <p className="text-sm text-muted-foreground">Loading news…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            type="button"
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {items.length === 0 ? "No news yet." : "Nothing in this category yet."}
        </p>
      ) : (
        <div className="flex flex-col gap-3" key={viewerTick}>
          {visible.map((item) => (
            <NewsItemRow
              key={item.id}
              item={item}
              read={isNewsItemRead(item.id)}
              liked={isNewsItemLiked(item.id)}
              onRead={() => handleRead(item.id)}
              onToggleLike={() => handleToggleLike(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
