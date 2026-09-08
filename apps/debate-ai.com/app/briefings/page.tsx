import type { Metadata } from "next"
import { Suspense } from "react"
import { PreRoundBriefingsPanel } from "debate-round"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Pre-Round Briefings",
  description: "Opponent scouting, judge tendencies, head-to-head record, and prep notes per round",
}

export default function BriefingsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/briefings" backHref="/debate" backLabel="round workspace" guide="training-tools" />
      <Suspense>
        <PreRoundBriefingsPanel />
      </Suspense>
    </ToolPage>
  )
}
