import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"
import { PrepWorkspacePage } from "@debate-ai/webview/routes/prep/page"
import { MOVED_PREP_SECTIONS } from "@debate-ai/webview/components/practice/moved-prep-sections"

export const metadata: Metadata = {
  title: "Prep Workspace",
  description:
    "Pre-round briefings, scout-to-strategy, opponent team profiles, judge profiles, prep notes and debater stats on one page",
}

/**
 * The Prep Workspace. Its old Practice Drills and Practice Partners tabs
 * (`?section=drills`, `?section=partners`) are their own pages now, so those
 * links redirect there.
 */
export default async function PrepPage({ searchParams }: { searchParams: Promise<{ section?: string | string[] }> }) {
  const { section } = await searchParams
  const moved = typeof section === "string" ? MOVED_PREP_SECTIONS[section] : undefined
  if (moved) permanentRedirect(moved)
  return <PrepWorkspacePage />
}
