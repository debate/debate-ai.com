/**
 * @fileoverview AI Response-Outcome Charts at `/coaching/outcomes`.
 *
 * The tool was taken out of every menu, but its saved vulnerability reports
 * still sync to the account (`vulnerabilityReports` in
 * `TOOL_RECORD_COLLECTIONS`) and Settings → Saved to your account links them
 * here, so the page has to stay routed. It is not in the `/tools` catalog,
 * which is why the header's title, description and icon are passed in rather
 * than looked up.
 */
import { Suspense } from "react"
import { BarChart3 } from "lucide-react"
import { RoundToolsCrossLinks, VulnerabilityChartsPanel } from "@debate-ai/practice-rounds"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

const OUTCOMES_HREF = "/coaching/outcomes"

export default function OutcomesPage() {
  return (
    <ToolPage>
      <ToolPageHeader
        href={OUTCOMES_HREF}
        backHref="/debate"
        backLabel="round workspace"
        guide="training-tools"
        title="AI Response-Outcome Charts"
        description="See which arguments in each round's flow are most exposed, try what-if responses, and ask an AI counsel panel."
        icon={BarChart3}
      >
        <RoundToolsCrossLinks currentHref={OUTCOMES_HREF} />
      </ToolPageHeader>
      <Suspense>
        <VulnerabilityChartsPanel />
      </Suspense>
    </ToolPage>
  )
}
