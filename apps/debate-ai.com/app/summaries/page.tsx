import type { Metadata } from "next"
import { Suspense } from "react"
import { FlowSummariesPanel } from "debate-practice-rounds"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Speech Transcript Summaries",
  description: "Per-argument summaries derived from each round's flow, with cross-exam questions and extension ideas",
}

export default function SummariesPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/summaries" backHref="/debate" backLabel="round workspace" guide="training-tools" />
      <Suspense>
        <FlowSummariesPanel />
      </Suspense>
    </ToolPage>
  )
}
