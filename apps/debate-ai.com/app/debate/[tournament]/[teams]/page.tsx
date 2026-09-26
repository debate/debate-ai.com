import type { Metadata } from "next"

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

export { default } from "debate-webview/routes/debate/[tournament]/[teams]/page"
