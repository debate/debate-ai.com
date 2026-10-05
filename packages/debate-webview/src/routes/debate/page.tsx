import { Suspense } from "react"
import { DebateFlowPage } from "@debate/round"
import { ToolSyncBadge } from "../../components/tools/ToolSyncBadge"

export default function Home() {
  return (
    <Suspense>
      <DebateFlowPage startScreenActions={<ToolSyncBadge href="/debate" />} />
    </Suspense>
  )
}
