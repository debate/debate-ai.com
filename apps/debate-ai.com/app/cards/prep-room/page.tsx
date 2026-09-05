import type { Metadata } from "next"
import { Suspense } from "react"
import { PrepRoomPanel } from "debate-team-collaboration"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Collaboration Prep Room",
  description: "A topic's shared prep space: evidence, draft blocks, and routed research tasks",
}

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
