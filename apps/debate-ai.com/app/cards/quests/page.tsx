import type { Metadata } from "next"
import { Suspense } from "react"
import { DailyQuestsWithIdentity } from "@/components/research/DailyQuestsWithIdentity"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Daily Quests",
  description: "Team goals like \"find 5 solvency cards\" — today's live progress against real contributions",
}

export default function CardsQuestsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/cards/quests" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <DailyQuestsWithIdentity />
      </Suspense>
    </ToolPage>
  )
}
