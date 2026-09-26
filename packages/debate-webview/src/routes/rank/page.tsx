import { Suspense } from "react"
import { LeaderboardPanel } from "debate-videos"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

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
