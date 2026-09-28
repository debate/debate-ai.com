import { Suspense } from "react"
import { DailyBestCardWithIdentity } from "../../../components/research/DailyBestCardWithIdentity"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

export default function CardsBestCardPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/cards/best-card" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <DailyBestCardWithIdentity />
      </Suspense>
    </ToolPage>
  )
}
