/**
 * @fileoverview News Stream panel — renders every seeded `NewsItem`
 * (`lib/news-stream.ts`) newest-first, grouped by category, with an unread
 * indicator per item (backed by `state/newsStream.ts`'s persisted read-id
 * set) and a "Mark all as read" action. Each item that names an in-app
 * route links straight to it, so the stream doubles as a feature-discovery
 * surface for tools that aren't otherwise obvious from `/tools` alone.
 *
 * @module panels/NewsStreamPanel
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import {
  NEWS_CATEGORY_LABELS,
  filterNewsItemsByCategory,
  sortNewsItemsByRecency,
  type NewsCategory,
} from "../lib/news-stream"
import { NEWS_ITEMS } from "../lib/news-stream"
import { getReadNewsItemIds, markAllNewsItemsRead, markNewsItemRead } from "../state/newsStream"

const CATEGORY_FILTERS: { value: NewsCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "editor", label: NEWS_CATEGORY_LABELS.editor },
  { value: "research", label: NEWS_CATEGORY_LABELS.research },
  { value: "practice", label: NEWS_CATEGORY_LABELS.practice },
  { value: "coaching", label: NEWS_CATEGORY_LABELS.coaching },
  { value: "community", label: NEWS_CATEGORY_LABELS.community },
]

export function NewsStreamPanel() {
  const [readIds, setReadIds] = useState<Set<string> | null>(null)
  const [category, setCategory] = useState<NewsCategory | "all">("all")

  useEffect(() => {
    setReadIds(getReadNewsItemIds())
  }, [])

  const items = useMemo(
    () => sortNewsItemsByRecency(filterNewsItemsByCategory(NEWS_ITEMS, category)),
    [category],
  )

  if (readIds === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading news…</div>
  }

  const handleOpen = (id: string) => {
    if (readIds.has(id)) return
    markNewsItemRead(id)
    setReadIds(getReadNewsItemIds())
  }

  const handleMarkAllRead = () => {
    markAllNewsItemsRead()
    setReadIds(getReadNewsItemIds())
  }

  const unreadCount = NEWS_ITEMS.filter((item) => !readIds.has(item.id)).length

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-foreground">News Stream</h1>
          <p className="text-sm text-muted-foreground">
            What's new across the whole product, newest first.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={handleMarkAllRead}>
            Mark all as read
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CATEGORY_FILTERS.map((filter) => (
          <Button
            key={filter.value}
            type="button"
            size="sm"
            variant={category === filter.value ? "default" : "outline"}
            onClick={() => setCategory(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      <ul className="space-y-3">
        {items.map((item) => {
          const unread = !readIds.has(item.id)
          const Wrapper = item.href ? "a" : "div"
          return (
            <li key={item.id}>
              <Wrapper
                {...(item.href ? { href: item.href } : {})}
                onClick={() => handleOpen(item.id)}
                className="block rounded-lg border border-border p-4 transition-colors hover:bg-accent"
              >
                <div className="mb-1 flex items-center gap-2">
                  {unread && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-primary"
                      aria-label="Unread"
                      title="Unread"
                    />
                  )}
                  <h2 className="text-sm font-semibold text-foreground">{item.title}</h2>
                  <Badge variant="outline" className="ml-auto shrink-0">
                    {NEWS_CATEGORY_LABELS[item.category]}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{item.summary}</p>
              </Wrapper>
            </li>
          )
        })}
      </ul>

      {items.length === 0 && (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No news in this category yet.
        </div>
      )}
    </div>
  )
}
