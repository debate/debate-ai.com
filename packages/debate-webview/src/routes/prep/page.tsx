import { Suspense } from "react"
import { PrepWorkspace, type PrepWorkspaceSectionId } from "../../components/practice/PrepWorkspace"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

/**
 * `/practice/prep` — the Prep Workspace. Outside Next the five old prep
 * routes mount this too, each opening on its own tab (the Next app redirects
 * them to `?section=` instead).
 */
export function PrepWorkspacePage({ initialSection }: { initialSection?: PrepWorkspaceSectionId }) {
  return (
    <ToolPage>
      <ToolPageHeader href="/practice/prep" backHref="/debate" backLabel="round workspace" guide="training-tools" />
      <Suspense>
        <PrepWorkspace initialSection={initialSection} />
      </Suspense>
    </ToolPage>
  )
}

export default function PrepPage() {
  return <PrepWorkspacePage />
}
