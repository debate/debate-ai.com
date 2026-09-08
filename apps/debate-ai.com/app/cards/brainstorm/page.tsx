import type { Metadata } from "next"
import { Suspense } from "react"
import { BrainstormBoardWithIdentity } from "@/components/research/BrainstormBoardWithIdentity"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Team Brainstorm Assist",
  description: "Submit and upvote squad ideas for an argument block, grouped into boards by category",
}

export default function CardsBrainstormPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/cards/brainstorm" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <BrainstormBoardWithIdentity />
      </Suspense>
    </ToolPage>
  )
}
