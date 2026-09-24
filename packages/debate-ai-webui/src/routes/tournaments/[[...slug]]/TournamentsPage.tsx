"use client"

import Link from "next/link"
import { TournamentsApp } from "debate-tournaments"

/** Client boundary for the package UI, with the app's router-aware links. */
export function TournamentsPage({ segments }: { segments: string[] }) {
  return <TournamentsApp segments={segments} basePath="/tournaments" apiBase="/api/tabroom" Link={Link} />
}
