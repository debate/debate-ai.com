import type { Metadata } from "next"
import { Suspense } from "react"
import { ReviewQueueWithIdentity } from "@/components/research/ReviewQueueWithIdentity"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Review Queue",
  description: "Move a submitted card through peer review — comment, request changes, approve, and publish",
}

export default function CardsReviewsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/cards/reviews" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <ReviewQueueWithIdentity />
      </Suspense>
    </ToolPage>
  )
}
