import { Suspense } from "react"
import { QuestStreaksWithIdentity } from "../../../components/research/QuestStreaksWithIdentity"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

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
