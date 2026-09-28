import { Suspense } from "react"
import { OpponentTeamProfilesPanel } from "debate-round"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

export default function OpponentsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/opponents" backHref="/debate" backLabel="round workspace" guide="training-tools" />
      <Suspense>
        <OpponentTeamProfilesPanel />
      </Suspense>
    </ToolPage>
  )
}
