import { Suspense } from "react"
import { PrepRoomPanel } from "debate-team-collaboration"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

export default function CardsPrepRoomPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/cards/prep-room" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <PrepRoomPanel />
      </Suspense>
    </ToolPage>
  )
}
