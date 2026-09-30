import { Suspense } from "react"
import { GroupChallengesWithIdentity } from "../../../components/research/GroupChallengesWithIdentity"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

export default function CardsGroupChallengesPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/research/cards/group-challenges" backHref="/research/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <GroupChallengesWithIdentity />
      </Suspense>
    </ToolPage>
  )
}
