import { Suspense } from "react"
import { JudgeDecisionPanel } from "debate-practice-rounds"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

export default function JudgeDecisionPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/judge-decision" backHref="/debate" backLabel="round workspace" guide="practice-tools" />
      <Suspense>
        <JudgeDecisionPanel />
      </Suspense>
    </ToolPage>
  )
}
