import { Suspense } from "react"
import { CoachingWorkspace, type CoachingSectionId } from "../../components/coach/CoachingWorkspace"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

/**
 * `/coaching` — Coaching: the Coach Workspace, AI Coach Mode, Coaching
 * Programs, Team Calendar and Coach Materials as tabs. Outside Next the four
 * old `/coaching/*` routes it replaced mount this too, each opening on its
 * own tab (the Next app redirects them to `?section=` instead).
 */
export function CoachingPage({ initialSection }: { initialSection?: CoachingSectionId }) {
  return (
    <ToolPage>
      <ToolPageHeader href="/coaching" backHref="/debate" backLabel="round workspace" guide="training-tools" />
      <Suspense>
        <CoachingWorkspace initialSection={initialSection} />
      </Suspense>
    </ToolPage>
  )
}

export default function CoachPage() {
  return <CoachingPage />
}
