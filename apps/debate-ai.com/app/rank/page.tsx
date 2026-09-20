import type { Metadata } from "next"
import { Suspense } from "react"
import { LeaderboardPanel } from "debate-videos"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Rankings",
  description: "Debate team rankings, leaderboard, and Elo ratings",
}

export default function RankPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/rank" backHref="/videos" backLabel="lectures" guide="training-tools" />
      <Suspense>
        <LeaderboardPanel />
      </Suspense>
    </ToolPage>
  )
}
