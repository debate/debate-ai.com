import { Suspense } from "react"
import { TopicCoverageDashboardPanel } from "debate-research-evidence"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

export default function CardsCoveragePage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/research/cards/coverage" backHref="/research/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <TopicCoverageDashboardPanel />
      </Suspense>
    </ToolPage>
  )
}
