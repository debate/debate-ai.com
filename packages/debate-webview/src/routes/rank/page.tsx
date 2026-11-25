import { Suspense } from "react"
import { HeadToHeadVideosProvider, LeaderboardPanel } from "@debate-ai/rankings/leaderboard"
import { HeadToHeadVideos } from "@debate-ai/videos"
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
        <HeadToHeadVideosProvider component={HeadToHeadVideos}>
          <LeaderboardPanel />
        </HeadToHeadVideosProvider>
      </Suspense>
    </ToolPage>
  )
}
