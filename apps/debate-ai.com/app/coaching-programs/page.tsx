import type { Metadata } from "next"
import { Suspense } from "react"
import { CoachingProgramsPanel } from "debate-team-collaboration"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"
import { CoachingProgramRosterAnalyticsWithDrills } from "./CoachingProgramRosterAnalyticsWithDrills"

export const metadata: Metadata = {
  title: "Coaching Programs",
  description: "Group coaching spaces scoped to a squad roster",
}

export default function CoachingProgramsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/coaching-programs" backHref="/debate" backLabel="round workspace" guide="training-tools" />
      <Suspense>
        <CoachingProgramsPanel />
      </Suspense>
      <div className="border-t border-border pt-6">
        <Suspense>
          <CoachingProgramRosterAnalyticsWithDrills />
        </Suspense>
      </div>
    </ToolPage>
  )
}
