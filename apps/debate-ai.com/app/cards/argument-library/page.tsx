import type { Metadata } from "next"
import { Suspense } from "react"
import { ArgumentLibraryPanel } from "debate-research-evidence"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Common Argument Library",
  description: "Browse shared research organized into topic folders, case areas, and tag-based collections",
}

export default function CardsArgumentLibraryPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/cards/argument-library" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <ArgumentLibraryPanel />
      </Suspense>
    </ToolPage>
  )
}
