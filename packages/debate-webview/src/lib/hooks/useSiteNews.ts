"use client"

/**
 * @fileoverview Fetches the News tab's site-wide items once on mount: the
 * newest rounds (`/api/videos`), the newest caselist files
 * (`/api/caselist-documents?recent=1`) and the latest forum threads
 * (`/api/forums`). Each source fails on its own — a failed fetch just
 * leaves that source out of the feed.
 *
 * @module lib/hooks/useSiteNews
 */

import { useEffect, useState } from "react"
import type { NewsItem } from "@debate-ai/community/src/lib/news-stream"
import type { VideoType } from "@debate-ai/types"
import { fetchForumThreads } from "@debate-ai/comments/forums/client"
import { buildFileNews, buildForumNews, buildRoundNews, type SiteNewsFile } from "../news/site-news"

/** Items fetched per source — enough to fill a screen without drowning the rest. */
export const SITE_NEWS_PER_SOURCE = 8

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
  try {
    const response = await fetch(url, { signal })
    return response.ok ? ((await response.json()) as T) : null
  } catch {
    return null
  }
}

async function loadSiteNews(signal: AbortSignal): Promise<NewsItem[]> {
  const rounds = new URLSearchParams({ source: "round", sort: "Recency", limit: String(SITE_NEWS_PER_SOURCE) })
  const [videos, files, forums] = await Promise.all([
    fetchJson<{ videos?: VideoType[] }>(`/api/videos?${rounds}`, signal),
    fetchJson<{ documents?: SiteNewsFile[] }>(`/api/caselist-documents?recent=1&limit=${SITE_NEWS_PER_SOURCE}`, signal),
    fetchForumThreads({ limit: SITE_NEWS_PER_SOURCE }).catch(() => null),
  ])
  return [
    ...buildRoundNews(videos?.videos ?? []),
    ...buildFileNews(files?.documents ?? []),
    ...buildForumNews(forums?.threads ?? []),
  ]
}

/** The News tab's rounds, files and forum items; `[]` until they load. */
export function useSiteNews(): NewsItem[] {
  const [items, setItems] = useState<NewsItem[]>([])
  useEffect(() => {
    const controller = new AbortController()
    loadSiteNews(controller.signal).then((loaded) => {
      if (!controller.signal.aborted) setItems(loaded)
    })
    return () => controller.abort()
  }, [])
  return items
}
