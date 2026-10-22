import { Suspense } from "react"
import { ExtensionFeatures, ExtensionInstallLink } from "../../components/research/ExtensionPromo"
import { ResearchHub } from "../../components/research/ResearchHub"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

export default function ResearchPage() {
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
        <ResearchHub />
      </Suspense>
    </ToolPage>
  )
}
