import { Suspense } from "react"
import { ContributorAwardsPanel } from "debate-community"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

export default function CardsAwardsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/research/cards/awards" backHref="/research/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <ContributorAwardsPanel />
      </Suspense>
    </ToolPage>
  )
}
