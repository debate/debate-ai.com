import { Suspense } from "react"
import { CoachingSessionsPanel, RoundToolsCrossLinks } from "debate-practice-rounds"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

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
