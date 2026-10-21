import { Suspense } from "react"
import { Scale } from "lucide-react"

import { RulesAndGlossary, type RulesAndGlossarySectionId } from "../../components/rules/RulesAndGlossary"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

/**
 * `/practice/rules` — Formats, Rules & Glossary: the formats-and-rules
 * reference and the glossary of debate terms, one tab each. Outside Next the
 * old `/practice/glossary` route mounts this too, opening on the Glossary tab
 * (the Next app redirects it to `?section=glossary` instead).
 *
 * Like `/news`, this is a destination in the sidebar tree rather than an
 * entry in the `/tools` catalog — it is reading material, not a tool — so the
 * header's title, description and icon are passed explicitly.
 */
export function RulesAndGlossaryPage({ initialSection }: { initialSection?: RulesAndGlossarySectionId }) {
  return (
    <ToolPage className="max-w-5xl">
      <ToolPageHeader
        href="/practice/rules"
        backHref="/debate"
        backLabel="round workspace"
        title="Formats, Rules & Glossary"
        description="A reference for the most common high-school debate formats and the rules behind them, plus a searchable glossary of debate terms."
        icon={Scale}
        guide="practice-tools"
      />
      <Suspense>
        <RulesAndGlossary initialSection={initialSection} />
      </Suspense>
    </ToolPage>
  )
}

export default function RulesPage() {
  return <RulesAndGlossaryPage />
}
