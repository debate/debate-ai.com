import type { Metadata } from "next"
import { PrepWorkspacePage } from "@debate-ai/webview/routes/prep/page"

export const metadata: Metadata = {
  title: "Prep Workspace",
  description:
    "Pre-round briefings, scout-to-strategy, opponent team profiles, judge profiles, prep notes, debater stats, practice drills and practice partners on one page",
}

/** The Prep Workspace; `?section=partners` opens Practice Partners and the Judge Pool. */
export default function PrepPage() {
  return <PrepWorkspacePage />
}
