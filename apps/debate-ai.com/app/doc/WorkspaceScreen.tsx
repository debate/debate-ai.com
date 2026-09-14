import { Suspense } from "react"
import ResearchAgentEmbed from "./ResearchAgentEmbed"

/**
 * The research workspace's page frame, shared by both of its routes: `/doc`,
 * and `/doc/<the open document's name>`. One screen with two addresses — the
 * name in the path is a record of which tab is open, not a different page
 * (see `lib/qwksearch/doc-paths`), so the frame lives here rather than being
 * written out twice.
 */
export function WorkspaceScreen() {
  return (
    <div className="h-screen flex flex-col pb-20 lg:pb-0">
      <div className="flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={null}>
          <ResearchAgentEmbed />
        </Suspense>
      </div>
    </div>
  )
}
