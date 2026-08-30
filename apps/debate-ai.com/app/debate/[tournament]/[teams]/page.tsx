import type { Metadata } from "next"
import { Suspense } from "react"
import { DebateFlowPage } from "debate-round"
import { notFound } from "next/navigation"
import { RoundSyncStatus } from "@/components/layout/RoundSyncStatus"

interface PageProps {
  params: Promise<{
    tournament: string
    teams: string
  }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tournament, teams } = await params
  const tournamentName = tournament.replace(/-/g, ' ')
  const teamsName = teams.replace(/-/g, ' ')

  return {
    title: `${tournamentName} - ${teamsName}`,
    description: `Debate round: ${teamsName} at ${tournamentName}`,
  }
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
      <RoundSyncStatus />
    </Suspense>
  )
}
