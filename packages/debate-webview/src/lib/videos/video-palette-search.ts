/**
 * @fileoverview The video library's rows for the app-wide Ctrl/Cmd-K palette
 * (`components/layout/command-palette/GlobalCommandPalette`).
 *
 * The library is a few thousand rounds and lectures in the `videos` table, far
 * too many to ship to every page just in case someone opens the palette. So
 * the palette asks the same paginated `/api/videos` feed the Videos page uses
 * (its `q` search runs in SQL over title, channel and description) for one
 * small page per query, and this module turns the returned tuples into rows:
 * a title, a one-line detail, round-or-lecture, and the watch page address.
 *
 * Pure apart from {@link fetchPaletteVideos}, so the row building is unit
 * tested on its own.
 *
 * @module lib/videos/video-palette-search
 */

import type { VideoType } from "@debate/types"
import { videoRouteHref } from "@debate/videos/src/lib/video-route"

/** How many videos one palette query asks for. */
export const PALETTE_VIDEO_LIMIT = 8

/** One video as the palette lists it. */
export interface PaletteVideo {
  id: string
  title: string
  /** `"Tournament · Round · Aff vs Neg"` for a round, the channel for a lecture. */
  detail: string
  kind: "round" | "lecture"
  href: string
}

/** A row from `/api/videos`, as the palette lists it. Index 6 is a numeric
 *  debate style for a round and a category string (or nothing) for a lecture. */
export function toPaletteVideo(video: VideoType): PaletteVideo {
  const [id, title, , channel, , , style, tournament, roundLevel, aff, neg] = video
  const kind = typeof style === "number" ? "round" : "lecture"
  const teams = aff && neg ? `${aff} vs ${neg}` : aff || neg || ""
  const roundDetail = [tournament, roundLevel, teams].filter(Boolean).join(" · ")
  return {
    id,
    title,
    detail: (kind === "round" && roundDetail) || channel || "",
    kind,
    href: videoRouteHref(video),
  }
}

/**
 * The most-viewed videos matching `query`, one small page. Rejects on a
 * network or server error; the caller treats that as no videos, since the
 * rest of the palette still works.
 */
export async function fetchPaletteVideos(query: string, signal?: AbortSignal): Promise<PaletteVideo[]> {
  const params = new URLSearchParams({ q: query, limit: String(PALETTE_VIDEO_LIMIT), sort: "Views" })
  const res = await fetch(`/api/videos?${params}`, { signal })
  if (!res.ok) throw new Error(`/api/videos ${res.status}`)
  const data = (await res.json()) as { videos?: VideoType[] }
  return (data.videos ?? []).map(toPaletteVideo)
}
