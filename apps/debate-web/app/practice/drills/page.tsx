import type { Metadata } from "next"
import DrillsPage from "@debate-ai/webview/routes/drills/page"

export const metadata: Metadata = {
  title: "Practice Drills",
  description: "Overview, frontline, cross-ex and collapse drills generated from each round's flow",
}

/** Practice Drills, in the sidebar's Practice section. The old Prep Workspace tab redirects here. */
export default function PracticeDrillsPage() {
  return <DrillsPage />
}
