"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { TournamentsApp } from "debate-tournaments/ui"

/**
 * The tournaments UI from `debate-tournaments`, mounted directly rather than
 * framed, reading live Tabroom through this app's `/api/tabroom-beta` proxy
 * (the API behind beta.tabroom.com), so the browser never makes a
 * cross-origin request. `/practice/tabroom` frames beta.tabroom.com itself.
 */
export default function Tournaments() {
  const { slug } = useParams<{ slug?: string[] }>()
  return (
    <TournamentsApp
      segments={slug ?? []}
      basePath="/practice/tournaments"
      apiBase="/api/tabroom-beta"
      Link={Link}
    />
  )
}