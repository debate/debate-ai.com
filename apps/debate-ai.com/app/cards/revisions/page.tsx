import type { Metadata } from "next"
import { Suspense } from "react"
import { RevisionIncentivesPanel } from "debate-research-evidence"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Revision Incentives",
  description: "Contributors ranked by reward points earned improving weak cards, strengthening citations, and refreshing stale evidence",
}

export default function CardsRevisionsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/cards/revisions" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <RevisionIncentivesPanel />
      </Suspense>
    </ToolPage>
  )
}
