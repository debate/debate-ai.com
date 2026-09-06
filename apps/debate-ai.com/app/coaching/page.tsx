import type { Metadata } from "next"
import { Suspense } from "react"
import { CoachingSessionsPanel, RoundToolsCrossLinks } from "debate-practice-rounds"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "AI Coach Mode",
  description: "Extension, refutation, collapse, and weighing prompts generated from each round's flow",
}

export default function CoachingPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/coaching" backHref="/debate" backLabel="round workspace" guide="training-tools">
        <RoundToolsCrossLinks currentHref="/coaching" />
      </ToolPageHeader>
      <Suspense>
        <CoachingSessionsPanel />
      </Suspense>
    </ToolPage>
  )
}
