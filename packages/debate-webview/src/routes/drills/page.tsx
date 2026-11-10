import { DrillSetsPanel, RoundToolsCrossLinks } from "@debate-ai/practice-rounds"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

/**
 * `/practice/drills` — Practice Drills, on its own page under the sidebar's
 * Practice section (it spent a while as a Prep Workspace tab; that tab's old
 * `/practice/prep?section=drills` address redirects here).
 */
export default function DrillsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/practice/drills" backHref="/practice/challenges" backLabel="online challenges" guide="training-tools" />
      <RoundToolsCrossLinks currentHref="/practice/drills" />
      <DrillSetsPanel />
    </ToolPage>
  )
}
