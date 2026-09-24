import { Suspense } from "react"
import { DebateFlowPage } from "debate-round"
import { notFound } from "next/navigation"

interface PageProps {
  params: Promise<{
    tournament: string
    teams: string
  }>
}

export default async function DebateRoundPage({ params }: PageProps) {
  const { tournament, teams } = await params

  // Validate the slug format
  if (!tournament || !teams) {
    notFound()
  }

  return (
    <Suspense>
      <DebateFlowPage />
    </Suspense>
  )
}
