import { Suspense } from "react"
import { ContributionsFeedWithIdentity } from "../../../components/research/ContributionsFeedWithIdentity"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

export default function CardsContributionsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/cards/contributions" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <ContributionsFeedWithIdentity />
      </Suspense>
    </ToolPage>
  )
}
