import { Suspense } from "react"
import { ReviewQueueWithIdentity } from "../../../components/research/ReviewQueueWithIdentity"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

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
