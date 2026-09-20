import type { Metadata } from "next"
import { Suspense } from "react"
import { ProgressUnlocksWithIdentity } from "@/components/research/ProgressUnlocksWithIdentity"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Progress Unlocks",
  description: "Every contributor's unlock tier, badges, and daily-quest streak",
}

export default function CardsProgressPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/cards/progress" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <ProgressUnlocksWithIdentity />
      </Suspense>
    </ToolPage>
  )
}
