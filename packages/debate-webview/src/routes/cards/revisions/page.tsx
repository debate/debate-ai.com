import { Suspense } from "react"
import { RevisionIncentivesPanel } from "debate-research-evidence"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

export default function CardsRevisionsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/cards/revisions" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <RevisionIncentivesPanel />
      </Suspense>
    </ToolPage>
  )
}
