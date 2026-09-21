import type { Metadata } from "next"
import { Suspense } from "react"
import { DailyBestCardWithIdentity } from "@/components/research/DailyBestCardWithIdentity"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Daily Best Card Challenge",
  description: "Today's highest-helpfulness card, plus every past day's winner",
}

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
