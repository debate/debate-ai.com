import { Suspense } from "react"
import { SprintNotesWithIdentity } from "../../../components/research/SprintNotesWithIdentity"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

export default function CardsCollaborationPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/cards/collaboration" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <SprintNotesWithIdentity />
      </Suspense>
    </ToolPage>
  )
}
