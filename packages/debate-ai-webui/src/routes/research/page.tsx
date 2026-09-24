import { Suspense } from "react"
import { ResearchHub } from "../../components/research/ResearchHub"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

export default function ResearchPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/research" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <ResearchHub />
      </Suspense>
    </ToolPage>
  )
}
