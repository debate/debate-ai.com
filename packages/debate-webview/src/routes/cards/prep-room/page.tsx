import { Suspense } from "react"
import { PrepRoomPanel } from "@debate/team-collaboration"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

export default function CardsPrepRoomPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/research/cards/prep-room" backHref="/research/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <PrepRoomPanel />
      </Suspense>
    </ToolPage>
  )
}
