import type { Metadata } from "next"
import { Suspense } from "react"
import { TaskInboxWithIdentity } from "@/components/research/TaskInboxWithIdentity"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Task Inbox",
  description: "Research tasks routed to contributors, grouped by topic",
}

export default function CardsInboxPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/cards/inbox" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <TaskInboxWithIdentity />
      </Suspense>
    </ToolPage>
  )
}
