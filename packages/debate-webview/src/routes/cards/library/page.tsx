import { Suspense } from "react"
import { Library } from "lucide-react"
import { EvidenceLibraryPanel } from "@debate-ai/research-evidence"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

/**
 * `/research/cards/library` — the Shared Evidence Library.
 *
 * Not in the tool catalog (`routes/tools/tool-groups.ts`): it left the tools
 * grid when card search gained its own "Submit card" popup, and the route
 * stays for deep links such as the browser extension's `?checkUrl=`. The
 * header can't take its copy from the catalog, so the title, description and
 * icon are passed here — the same copy `/practice/features` shows. Without
 * them the heading fell back to the raw path.
 */
export default function CardsLibraryPage() {
  return (
    <ToolPage>
      <ToolPageHeader
        href="/research/cards/library"
        backHref="/research/cards"
        backLabel="shared cards"
        title="Shared Evidence Library"
        description="Search cut cards and reusable analytic blocks by keyword, citation, or argument, and submit your own."
        icon={Library}
        guide="research-collaboration"
      />
      <Suspense>
        <EvidenceLibraryPanel />
      </Suspense>
    </ToolPage>
  )
}
