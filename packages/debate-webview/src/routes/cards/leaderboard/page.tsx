import { Suspense } from "react"
import { ContributionLeaderboardWithIdentity } from "../../../components/research/ContributionLeaderboardWithIdentity"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

export default function CardsLeaderboardPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/cards/leaderboard" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <ContributionLeaderboardWithIdentity />
      </Suspense>
    </ToolPage>
  )
}
