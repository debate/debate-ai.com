"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { TournamentsApp } from "@debate/tournaments/ui"

/**
 * The tournaments UI from `debate-tournaments`, mounted directly rather than
 * framed, reading and writing through this app's own `/api/tabroom` — the
 * vendored Tabroom API on this site's D1, with the host page's creation routes
 * under `/api/tabroom/host`. `/practice/tabroom` frames beta.tabroom.com
 * itself, and the Tournaments list frames it from a button.
 */
export default function Tournaments() {
  const { slug } = useParams<{ slug?: string[] }>()
  return (
    <TournamentsApp
      segments={slug ?? []}
      basePath="/practice/tournaments"
      apiBase="/api/tabroom"
      Link={Link}
    />
  )
}