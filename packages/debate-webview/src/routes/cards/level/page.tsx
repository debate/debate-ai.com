import { DebaterLevelPanel } from "debate-community"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

export default function CardsLevelPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/cards/level" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <DebaterLevelPanel />
    </ToolPage>
  )
}
