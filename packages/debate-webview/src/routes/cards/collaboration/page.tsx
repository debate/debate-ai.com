import { Suspense } from "react"
import { SprintNotesWithIdentity } from "../../../components/research/SprintNotesWithIdentity"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

export default function CardsCollaborationPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/research/cards/collaboration" backHref="/research/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <SprintNotesWithIdentity />
      </Suspense>
    </ToolPage>
  )
}
