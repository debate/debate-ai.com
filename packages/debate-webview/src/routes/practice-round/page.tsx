import { Suspense } from "react"
import { PracticeRoundSimulatorPanel } from "debate-practice-rounds"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

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
