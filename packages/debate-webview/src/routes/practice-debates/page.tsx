import { Suspense } from "react"
import { PracticeDebates } from "../../components/practice/PracticeDebates"
import type { PracticeDebatesSectionId } from "../../components/practice/practice-debates-sections"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

/**
 * `/practice/debates` — Practice Debates: Online Challenges, Practice Drills
 * and Practice Partners, one tab each. Outside Next the old
 * `/practice/challenges`, `/practice/drills` and `/practice/partners` routes
 * mount this too, opening on their tab (the Next app redirects them to
 * `?section=` instead).
 */
export function PracticeDebatesPage({ initialSection }: { initialSection?: PracticeDebatesSectionId }) {
  return (
    <ToolPage>
      <ToolPageHeader href="/practice/debates" backHref="/practice/versus-ai" backLabel="practice vs AI" guide="practice-tools" />
      <Suspense>
        <PracticeDebates initialSection={initialSection} />
      </Suspense>
    </ToolPage>
  )
}

export default function PracticeDebatesRoute() {
  return <PracticeDebatesPage />
}
