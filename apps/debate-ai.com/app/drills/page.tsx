import type { Metadata } from "next"
import { Suspense } from "react"
import { DrillSetsPanel, RoundToolsCrossLinks } from "debate-practice-rounds"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Practice Drills",
  description: "Quick practice drills generated from each round's flow",
}

export default function DrillsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/drills" backHref="/debate" backLabel="round workspace" guide="training-tools">
        <RoundToolsCrossLinks currentHref="/drills" />
      </ToolPageHeader>
      <Suspense>
        <DrillSetsPanel />
      </Suspense>
    </ToolPage>
  )
}
