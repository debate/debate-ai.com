import type { Metadata } from "next"
import { Suspense } from "react"
import { GroupChallengesWithIdentity } from "@/components/research/GroupChallengesWithIdentity"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Group Challenges",
  description: "Create squad-scoped friendly challenges like completing a set of blocks or winning a rebuttal exercise",
}

export default function CardsGroupChallengesPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/cards/group-challenges" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <GroupChallengesWithIdentity />
      </Suspense>
    </ToolPage>
  )
}
