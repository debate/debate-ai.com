import { Suspense } from "react"
import { ExtensionFeatures, ExtensionInstallLink } from "../../components/research/ExtensionPromo"
import { ResearchHub } from "../../components/research/ResearchHub"
import type { ResearchSectionId } from "../../components/research/research-section-ids"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

/**
 * `/research` — the Research Workspace. Outside Next the old Team Research
 * routes (`/research/team`, the `/research/cards/*` tools it replaced and
 * `/practice/level`) mount this too, each opening on its matching tab (the
 * Next app redirects them to `?section=` instead).
 */
export function ResearchWorkspacePage({ initialSection }: { initialSection?: ResearchSectionId }) {
  return (
    <ToolPage>
      <ToolPageHeader
        href="/research"
        backHref="/research/cards"
        backLabel="shared cards"
        guide="research-collaboration"
        actions={<ExtensionInstallLink />}
      >
        <ExtensionFeatures />
      </ToolPageHeader>
      <Suspense>
        <ResearchHub initialSection={initialSection} />
      </Suspense>
    </ToolPage>
  )
}

export default function ResearchPage() {
  return <ResearchWorkspacePage />
}
