import type { Metadata } from "next"
import { Suspense } from "react"
import { SprintNotesWithIdentity } from "@/components/research/SprintNotesWithIdentity"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Team Collaboration Mode",
  description: "Leave live prep notes on a shared topic sprint, grouped by topic",
}

export default function CardsCollaborationPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/cards/collaboration" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <SprintNotesWithIdentity />
      </Suspense>
    </ToolPage>
  )
}
