import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"
import { PrepWorkspacePage } from "@debate-ai/webview/routes/prep/page"

export const metadata: Metadata = {
  title: "Prep Workspace",
  description:
    "Pre-round briefings, scout-to-strategy, opponent team profiles, judge profiles, prep notes, debater stats and practice drills on one page",
}

/**
 * The Prep Workspace. Practice Partners used to be its "partners" tab and now
 * opens first in Team Research, so `?section=partners` — in bookmarks and in
 * notifications already stored with that link — permanently redirects there.
 * A `#judge-pool` fragment survives the redirect.
 */
export default async function PrepPage({ searchParams }: { searchParams: Promise<{ section?: string | string[] }> }) {
  const { section } = await searchParams
  if (section === "partners") permanentRedirect("/research/team?section=partners")
  return <PrepWorkspacePage />
}
