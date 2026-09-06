import type { Metadata } from "next"
import { Suspense } from "react"
import { VulnerabilityChartsPanel, RoundToolsCrossLinks } from "debate-practice-rounds"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "AI Response-Outcome Charts",
  description: "Per-side exposure and the most vulnerable arguments in each round's flow",
}

export default function OutcomesPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/outcomes" backHref="/debate" backLabel="round workspace" guide="training-tools">
        <RoundToolsCrossLinks currentHref="/outcomes" />
      </ToolPageHeader>
      <Suspense>
        <VulnerabilityChartsPanel />
      </Suspense>
    </ToolPage>
  )
}
