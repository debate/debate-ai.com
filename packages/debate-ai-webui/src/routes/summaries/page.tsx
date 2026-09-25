import { Suspense } from "react"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"
import { FlowSummariesPanelWithPrepNotes } from "./FlowSummariesPanelWithPrepNotes"

export default function SummariesPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/summaries" backHref="/debate" backLabel="round workspace" guide="training-tools" />
      <Suspense>
        <FlowSummariesPanelWithPrepNotes />
      </Suspense>
    </ToolPage>
  )
}
