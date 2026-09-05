import type { Metadata } from "next"
import { Suspense } from "react"
import { ArgumentTreePanel, RoundToolsCrossLinks } from "debate-practice-rounds"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Argument Tree Outline",
  description: "Filterable outline of each round's flow, grouped by heading",
}

export default function OutlinePage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/outline" backHref="/debate" backLabel="round workspace" guide="training-tools">
        <RoundToolsCrossLinks currentHref="/outline" />
      </ToolPageHeader>
      <Suspense>
        <ArgumentTreePanel />
      </Suspense>
    </ToolPage>
  )
}
