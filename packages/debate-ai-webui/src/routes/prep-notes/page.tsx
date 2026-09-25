import { Suspense } from "react"
import { PrepNotesWithIdentity } from "../../components/research/PrepNotesWithIdentity"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

export default function PrepNotesPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/prep-notes" backHref="/debate" backLabel="round workspace" guide="training-tools" />
      <Suspense>
        <PrepNotesWithIdentity />
      </Suspense>
    </ToolPage>
  )
}
