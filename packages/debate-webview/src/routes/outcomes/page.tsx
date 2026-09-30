import { Suspense } from "react"
import { VulnerabilityChartsPanel, RoundToolsCrossLinks } from "debate-practice-rounds"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

export default function OutcomesPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/coaching/outcomes" backHref="/debate" backLabel="round workspace" guide="training-tools">
        <RoundToolsCrossLinks currentHref="/coaching/outcomes" />
      </ToolPageHeader>
      <Suspense>
        <VulnerabilityChartsPanel />
      </Suspense>
    </ToolPage>
  )
}
