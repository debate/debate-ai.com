import type { Metadata } from "next"
import { Suspense } from "react"
import { ResearchHub } from "@/components/research/ResearchHub"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Research",
  description:
    "Squad research workspace: topic coverage, evidence library, task routing, quests, leaderboards and peer review",
}

export default function ResearchPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/research" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <ResearchHub />
      </Suspense>
    </ToolPage>
  )
}
