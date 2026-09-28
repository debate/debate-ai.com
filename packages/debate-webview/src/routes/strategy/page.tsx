import { Suspense } from "react"
import { StrategyPanel } from "debate-round"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

export default function StrategyPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/strategy" backHref="/debate" backLabel="round workspace" guide="training-tools" />
      <Suspense>
        <StrategyPanel />
      </Suspense>
    </ToolPage>
  )
}
