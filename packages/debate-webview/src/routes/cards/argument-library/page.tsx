import { Suspense } from "react"
import { ArgumentLibraryPanel } from "@debate-ai/research-evidence"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

export default function CardsArgumentLibraryPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/research/cards/argument-library" backHref="/research/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <ArgumentLibraryPanel />
      </Suspense>
    </ToolPage>
  )
}
