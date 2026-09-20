import type { Metadata } from "next"
import { Suspense } from "react"
import { EvidenceLibraryPanel } from "debate-research-evidence"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Shared Evidence Library",
  description: "Search cut cards and reusable analytic blocks by keyword, citation, or argument",
}

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
