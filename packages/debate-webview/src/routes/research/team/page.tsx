import { Suspense } from "react"
import {
  TeamResearchWorkspace,
  type TeamResearchSectionId,
} from "../../../components/research/TeamResearchWorkspace"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

/**
 * `/research/team` — Team Research, part of the Research Workspace. Outside
 * Next the old routes it replaced (the `/research/cards/*` tools,
 * `/practice/level` and `/practice/partners`) mount this too, each opening on
 * its own tab (the Next app redirects them to `?section=` instead).
 */
export function TeamResearchPage({ initialSection }: { initialSection?: TeamResearchSectionId }) {
  return (
    <ToolPage>
      <ToolPageHeader href="/research/team" backHref="/research" backLabel="research workspace" guide="research-collaboration" />
      <Suspense>
        <TeamResearchWorkspace initialSection={initialSection} />
      </Suspense>
    </ToolPage>
  )
}

export default function TeamResearchRoute() {
  return <TeamResearchPage />
}
