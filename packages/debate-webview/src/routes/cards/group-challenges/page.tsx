import { Suspense } from "react"
import { GroupChallengesWithIdentity } from "../../../components/research/GroupChallengesWithIdentity"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

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
