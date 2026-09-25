"use client"

import { useParams } from "next/navigation"
import { TournamentsPage } from "./TournamentsPage"

/**
 * Every tournament page — the route table lives in `debate-tournaments`.
 *
 * Reads the segments with `useParams()` rather than the page's `params` prop
 * so the same component renders under Next and under a host's own router.
 */
export default function Tournaments() {
  const { slug } = useParams<{ slug?: string[] }>()
  return <TournamentsPage segments={Array.isArray(slug) ? slug : slug ? [slug] : []} />
}
