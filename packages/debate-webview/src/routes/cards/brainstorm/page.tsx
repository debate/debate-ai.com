import { Suspense } from "react"
import { BrainstormBoardWithIdentity } from "../../../components/research/BrainstormBoardWithIdentity"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

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
