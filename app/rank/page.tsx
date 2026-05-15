import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { LeaderboardPanel } from "@/components/debate/DebateVideos/panels/RankingsLeaderboardPanel"

export const metadata: Metadata = {
  title: "Rankings",
  description: "Debate team rankings, leaderboard, and Elo ratings",
}

export default function RankPage() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="mb-4">
        <Link
          href="/videos"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground transition-colors"
          aria-label="Back to lectures"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      <Suspense>
        <LeaderboardPanel />
      </Suspense>
    </div>
  )
}