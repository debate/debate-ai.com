import { Suspense } from "react"
import { RevisionIncentivesPanel } from "@debate/research-evidence"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

export default function CardsRevisionsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/research/cards/revisions" backHref="/research/cards" backLabel="shared cards" guide="research-collaboration" syncCollections={["revisionHistory"]} />
      <Suspense>
        <RevisionIncentivesPanel />
      </Suspense>
    </ToolPage>
  )
}
