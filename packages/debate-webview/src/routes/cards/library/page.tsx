import { Suspense } from "react"
import { EvidenceLibraryPanel } from "debate-research-evidence"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

export default function CardsLibraryPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/cards/library" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <EvidenceLibraryPanel />
      </Suspense>
    </ToolPage>
  )
}
