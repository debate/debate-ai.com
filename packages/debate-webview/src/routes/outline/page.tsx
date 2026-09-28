import { Suspense } from "react"
import { ArgumentTreePanel, RoundToolsCrossLinks } from "debate-practice-rounds"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

export default function OutlinePage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/outline" backHref="/debate" backLabel="round workspace" guide="training-tools">
        <RoundToolsCrossLinks currentHref="/outline" />
      </ToolPageHeader>
      <Suspense>
        <ArgumentTreePanel />
      </Suspense>
    </ToolPage>
  )
}
