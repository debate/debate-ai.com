import { Suspense } from "react"
import { TeamCalendarPanel } from "@debate/team-collaboration"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

export default function TeamCalendarPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/coaching/calendar" backHref="/coaching/programs" backLabel="coaching programs" guide="training-tools" />
      <Suspense>
        <TeamCalendarPanel />
      </Suspense>
    </ToolPage>
  )
}
