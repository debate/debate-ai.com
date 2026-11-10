import type { Metadata } from "next"
import PracticePartnersPage from "@debate-ai/webview/routes/practice-partners/page"

export const metadata: Metadata = {
  title: "Practice Partners",
  description:
    "Challenge other debaters to a virtual practice round, volunteer to debate, judge or coach, and hire judges from the Judge Pool",
}

/**
 * Practice Partners with the Judge Pool below it, in the sidebar's Practice
 * section. The old Prep Workspace tab (`/practice/prep?section=partners`) and
 * `/research/team?section=partners` redirect here; a `#judge` fragment survives.
 */
export default function PartnersPage() {
  return <PracticePartnersPage />
}
