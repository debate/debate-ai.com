import { Suspense } from "react"
import { EvidenceLibraryPanel } from "@debate/research-evidence"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

export default function CardsLibraryPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/research/cards/library" backHref="/research/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <EvidenceLibraryPanel />
      </Suspense>
    </ToolPage>
  )
}
