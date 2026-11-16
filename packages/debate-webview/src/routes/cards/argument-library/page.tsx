import { Suspense } from "react"
import { FolderTree } from "lucide-react"
import { ArgumentLibraryPanel } from "@debate-ai/research-evidence"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

/**
 * `/research/cards/argument-library` — the Common Argument Library.
 *
 * Like the Shared Evidence Library next to it, this route left the tool
 * catalog (`routes/tools/tool-groups.ts`) and stays for deep links, so the
 * header's title, description and icon are passed here — the same copy
 * `/practice/features` shows. Without them the heading fell back to the raw
 * path.
 */
export default function CardsArgumentLibraryPage() {
  return (
    <ToolPage>
      <ToolPageHeader
        href="/research/cards/argument-library"
        backHref="/research/cards"
        backLabel="shared cards"
        title="Common Argument Library"
        description="Browse shared research organized into topic folders, case areas, and tag-based collections."
        icon={FolderTree}
        guide="research-collaboration"
      />
      <Suspense>
        <ArgumentLibraryPanel />
      </Suspense>
    </ToolPage>
  )
}
