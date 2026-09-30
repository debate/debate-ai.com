import { DebaterLevelPanel } from "debate-community"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

export default function CardsLevelPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/practice/level" backHref="/research/cards" backLabel="shared cards" guide="research-collaboration" />
      <DebaterLevelPanel />
    </ToolPage>
  )
}
