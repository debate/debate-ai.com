import { Suspense } from "react"
import { JudgeDecisionPanel } from "@debate-ai/practice-rounds"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

export default function JudgeDecisionPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/practice/judge-decision" backHref="/debate" backLabel="round workspace" guide="practice-tools" />
      <Suspense>
        <JudgeDecisionPanel />
      </Suspense>
    </ToolPage>
  )
}
