"use client"

import { Suspense } from "react"
import { ViewerDebateFlowPage } from "../../../../components/round/ViewerDebateFlowPage"
import { notFound, useParams } from "next/navigation"

export default function DebateRoundPage() {
  const { tournament, teams } = useParams<{ tournament: string; teams: string }>()

  // Validate the slug format
  if (!tournament || !teams) {
    notFound()
  }

  return (
    <Suspense>
      <ViewerDebateFlowPage />
    </Suspense>
  )
}
