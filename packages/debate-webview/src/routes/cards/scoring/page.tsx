import { Suspense } from "react"
import { CardScoringPanel } from "debate-research-evidence"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

export default function CardsScoringPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/research/cards/scoring" backHref="/research/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <CardScoringPanel />
      </Suspense>
    </ToolPage>
  )
}
