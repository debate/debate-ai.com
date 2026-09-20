import type { Metadata } from "next"
import { Suspense } from "react"
import { CardScoringPanel } from "debate-research-evidence"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "LLM Card Scoring",
  description: "Score cards for relevance, clarity, uniqueness, evidence quality, and usability",
}

export default function CardsScoringPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/cards/scoring" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <CardScoringPanel />
      </Suspense>
    </ToolPage>
  )
}
