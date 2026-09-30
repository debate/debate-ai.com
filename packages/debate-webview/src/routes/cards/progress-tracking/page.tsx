import { Suspense } from "react"
import { ResearchProgressWithIdentity } from "../../../components/research/ResearchProgressWithIdentity"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

export default function CardsProgressTrackingPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/coaching/progress" backHref="/research/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <ResearchProgressWithIdentity />
      </Suspense>
    </ToolPage>
  )
}
