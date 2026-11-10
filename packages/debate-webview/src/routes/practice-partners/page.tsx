import { JudgePoolPanel, PracticePartnersPanel } from "@debate-ai/practice-rounds"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

/**
 * `/practice/partners` — Practice Partners with the Judge Pool below it, on
 * its own page under the sidebar's Practice section. The old Prep Workspace
 * tab (`/practice/prep?section=partners`) and `/research/team?section=partners`
 * redirect here.
 */
export default function PracticePartnersPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/practice/partners" backHref="/practice/challenges" backLabel="online challenges" guide="practice-tools" />
      <PracticePartnersPanel />
      <JudgePoolPanel className="mt-4" />
    </ToolPage>
  )
}
