import type { Metadata } from "next"
import { Suspense } from "react"
import { JudgeDecisionPanel } from "debate-practice-rounds"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "AI Judge Decision",
  description: "AI-generated round decisions under a round's saved judge paradigm and flow summary",
}

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
