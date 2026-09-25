import { Suspense } from "react"
import { OpponentPersonaPickerPanel } from "debate-practice-rounds"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

export default function PracticeOpponentPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/practice-opponent" backHref="/debate" backLabel="round workspace" guide="practice-tools" />
      <Suspense>
        <OpponentPersonaPickerPanel />
      </Suspense>
    </ToolPage>
  )
}
