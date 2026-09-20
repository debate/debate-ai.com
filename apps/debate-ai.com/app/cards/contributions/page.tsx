import type { Metadata } from "next"
import { Suspense } from "react"
import { ContributionsFeedWithIdentity } from "@/components/research/ContributionsFeedWithIdentity"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Contributions Feed",
  description: "Submit, like, save, and endorse the community's cards, summaries, highlights, and annotations",
}

export default function CardsContributionsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/cards/contributions" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <ContributionsFeedWithIdentity />
      </Suspense>
    </ToolPage>
  )
}
