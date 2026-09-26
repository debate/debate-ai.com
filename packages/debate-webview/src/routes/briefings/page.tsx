import { Suspense } from "react"
import { PreRoundBriefingsPanel } from "debate-round"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

export default function BriefingsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/briefings" backHref="/debate" backLabel="round workspace" guide="training-tools" />
      <Suspense>
        <PreRoundBriefingsPanel />
      </Suspense>
    </ToolPage>
  )
}
