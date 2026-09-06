import type { Metadata } from "next"
import { Suspense } from "react"
import { PracticeRoundSimulatorPanel } from "debate-practice-rounds"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Practice Round Simulator",
  description: "Recreate a tournament round with a timer, judge paradigm, and AI opponent persona",
}

export default function PracticeRoundPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/practice-round" backHref="/debate" backLabel="round workspace" guide="practice-tools" />
      <Suspense>
        <PracticeRoundSimulatorPanel />
      </Suspense>
    </ToolPage>
  )
}
