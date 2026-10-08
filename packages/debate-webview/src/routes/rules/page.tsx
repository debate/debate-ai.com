import { Scale } from "lucide-react"

import { FormatsRulesGuide } from "../../components/rules/FormatsRulesGuide"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

/**
 * Formats & Rules: a reference page for the common high-school formats and
 * the research, evidence, device/AI and per-format rules behind them.
 *
 * Like `/practice/forums`, this is a destination in the sidebar tree rather than an
 * entry in the `/tools` catalog — it is reading material, not a tool — so the
 * header's title, description and icon are passed explicitly.
 */
export default function RulesPage() {
  return (
    <ToolPage className="max-w-5xl">
      <ToolPageHeader
        href="/practice/rules"
        backHref="/debate"
        backLabel="round workspace"
        title="Debate Formats, Research & Rules"
        description="A one-page reference for the most common high-school debate formats, their key round sections, and the research, evidence, conduct, and format-specific rules students need to know."
        icon={Scale}
        guide="practice-tools"
      />
      <FormatsRulesGuide />
    </ToolPage>
  )
}
