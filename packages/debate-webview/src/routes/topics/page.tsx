import { ChartBar } from "lucide-react"

import { TopicAreasExplorer } from "../../components/topics/TopicAreasExplorer"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

/**
 * Topic Areas: every NDT, Policy, LD and PF resolution since 2000, grouped
 * into research areas and ranked by how often each has been debated.
 *
 * A sidebar destination rather than a `/tools` catalog entry, for the same
 * reason as `/rules` — so the header copy is passed explicitly.
 */
export default function TopicsPage() {
  return (
    <ToolPage className="max-w-5xl">
      <ToolPageHeader
        href="/topics"
        backHref="/tools"
        backLabel="tools"
        title="Debate Topics Explorer"
        description="Every resolution since 2000, split into focused research areas and ranked by how often each area has been debated — overall and within each format."
        icon={ChartBar}
        guide="research-collaboration"
      />
      <TopicAreasExplorer />
    </ToolPage>
  )
}
