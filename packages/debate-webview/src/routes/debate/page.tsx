import { Suspense } from "react"
import { ViewerDebateFlowPage } from "../../components/round/ViewerDebateFlowPage"
import { ToolSyncBadge } from "../../components/tools/ToolSyncBadge"

export default function Home() {
  return (
    <Suspense>
      <ViewerDebateFlowPage
        startScreenActions={<ToolSyncBadge href="/debate" />}
        roundActions={<ToolSyncBadge href="/debate" />}
      />
    </Suspense>
  )
}
