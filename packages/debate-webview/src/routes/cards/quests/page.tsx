import { Suspense } from "react"
import { DailyQuestsWithIdentity } from "../../../components/research/DailyQuestsWithIdentity"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

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
