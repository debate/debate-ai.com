"use client"

import { useParams } from "next/navigation"
import { LiveRoundPage } from "@debate-ai/videos"

/**
 * A live round stream's page (`/videos/live/<id>`) outside Next. The player
 * reads `/api/live-rounds` itself, so this only passes the id through, the
 * same as `app/videos/live/[id]/page.tsx`.
 */
export default function LiveRoundRoute() {
  const params = useParams<{ id?: string }>()
  if (!params.id) return null
  return <LiveRoundPage streamId={params.id} />
}
