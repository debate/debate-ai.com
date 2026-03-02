import type { Metadata } from "next"
import { LeaderboardPanel } from "@/components/debate/videos/panels/LeaderboardPanel"

export const metadata: Metadata = {
  title: "Rankings",
  description: "Debate team rankings, leaderboard, and Elo ratings",
}

export default function RankPage() {
  return (
    <div className="min-h-screen bg-background">
      <LeaderboardPanel />
    </div>
  )
}