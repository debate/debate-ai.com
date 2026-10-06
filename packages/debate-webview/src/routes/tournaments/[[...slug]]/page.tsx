"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { TournamentsApp } from "@debate/tournaments/ui"

/**
 * The tournaments UI from `debate-tournaments`, mounted directly rather than
 * framed. Live Tabroom's tournaments, pairings and results come through this
 * app's read-only `/api/tabroom-beta` proxy; tournaments hosted here (and the
 * demo anyone can browse as its admin) come from `/api/tabroom`, the vendored
 * Tabroom API on this site's D1, whose `/host` routes create them and serve
 * their admin view. `/practice/tabroom` frames beta.tabroom.com itself.
 */
export default function Tournaments() {
  const { slug } = useParams<{ slug?: string[] }>()
  return (
    <TournamentsApp
      segments={slug ?? []}
      basePath="/tournaments"
      apiBase="/api/tabroom"
      liveApiBase="/api/tabroom-beta"
      Link={Link}
    />
  )
}