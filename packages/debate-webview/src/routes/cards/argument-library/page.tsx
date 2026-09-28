import { Suspense } from "react"
import { ArgumentLibraryPanel } from "debate-research-evidence"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

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
