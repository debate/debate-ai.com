import { Suspense } from "react"
import { ContributionsFeedWithIdentity } from "../../../components/research/ContributionsFeedWithIdentity"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

export default function CardsContributionsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/research/cards/contributions" backHref="/research/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <ContributionsFeedWithIdentity />
      </Suspense>
    </ToolPage>
  )
}
