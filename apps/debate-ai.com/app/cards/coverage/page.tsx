import type { Metadata } from "next"
import { Suspense } from "react"
import { TopicCoverageDashboardPanel } from "debate-research-evidence"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Topic Coverage Dashboard",
  description: "See which arguments are well-covered, which are missing, and where the team needs more work",
}

export default function CardsCoveragePage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/cards/coverage" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <TopicCoverageDashboardPanel />
      </Suspense>
    </ToolPage>
  )
}
