import type { Metadata } from "next"
import { Suspense } from "react"
import { StrategyPanel } from "debate-round"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Scout-to-Strategy",
  description: "Case-choice rankings, judge-adaptation notes, and matchup risk level from scouted opponent and judge data",
}

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
