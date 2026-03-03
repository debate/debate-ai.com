import type { Metadata } from "next"
import { Suspense } from "react"
import { LeaderboardPanel } from "@/components/debate/DebateVideos/panels/RankingsLeaderboardPanel"

export const metadata: Metadata = {
  title: "Rankings",
  description: "Debate team rankings, leaderboard, and Elo ratings",
}

export default function RankPage() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense>
        <LeaderboardPanel />
      </Suspense>
    </div>
  )
}