import { Suspense } from "react"
import { TopicCoverageDashboardPanel } from "debate-research-evidence"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

export default function CardsCoveragePage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/cards/coverage" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <TopicCoverageDashboardPanel />
      </Suspense>
    </ToolPage>
  )
}
