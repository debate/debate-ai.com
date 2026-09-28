import { Suspense } from "react"
import { FlowAnnotationsPanel } from "debate-practice-rounds"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

export default function AnnotationsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/annotations" backHref="/debate" backLabel="round workspace" guide="training-tools" />
      <Suspense>
        <FlowAnnotationsPanel />
      </Suspense>
    </ToolPage>
  )
}
