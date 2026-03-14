import type { Metadata } from "next"
import { Suspense } from "react"
import { DebateFlowPage } from "@/components/debate/DebateRound/DebateRoundPanel"
import { notFound } from "next/navigation"

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
    </Suspense>
  )
}
https://debate-ai.com/debate/2026-aberdeen-novice-online-debate-1/0-yamily-tx-adl-tw