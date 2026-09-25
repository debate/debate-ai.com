import { Suspense } from "react"
import { JudgeParadigmPickerPanel } from "debate-practice-rounds"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

export default function ParadigmsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/paradigms" backHref="/debate" backLabel="round workspace" guide="practice-tools" />
      <Suspense>
        <JudgeParadigmPickerPanel />
      </Suspense>
    </ToolPage>
  )
}
