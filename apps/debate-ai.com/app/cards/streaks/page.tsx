import type { Metadata } from "next"
import { Suspense } from "react"
import { QuestStreaksWithIdentity } from "@/components/research/QuestStreaksWithIdentity"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Quest Streaks",
  description: "Every contributor's daily-quest streak and the milestone badges it has earned",
}

export default function CardsStreaksPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/cards/streaks" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <QuestStreaksWithIdentity />
      </Suspense>
    </ToolPage>
  )
}
