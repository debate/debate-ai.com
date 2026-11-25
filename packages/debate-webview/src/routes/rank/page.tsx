import { Suspense } from "react"
import { LeaderboardPanel } from "@debate-ai/rankings/leaderboard"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

export default function RankPage() {
  return (
    <ToolPage>
      <ToolPageHeader
        href="/rank"
        backHref="/videos"
        backLabel="lectures"
        guide="training-tools"
        description=""
        highlights={[]}
      />
      <Suspense>
        <LeaderboardPanel />
      </Suspense>
    </ToolPage>
  )
}
