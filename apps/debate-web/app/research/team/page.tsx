import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"
import { researchHref, researchSectionForTeamSection } from "@debate-ai/webview/components/research/research-section-ids"

/**
 * The old address of Team Research. Its tabs merged into the Research
 * Workspace at `/research`, and its Practice Partners tab moved to the Prep
 * Workspace, so `/research/team?section=…` — in bookmarks and in
 * notifications already stored with that link — permanently redirects to
 * whichever tab now holds it. A `#judge-pool` fragment survives the redirect.
 */

export const metadata: Metadata = {
  title: "Research Workspace",
  alternates: { canonical: "/research" },
}

export default async function LegacyTeamResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string | string[] }>
}) {
  const { section } = await searchParams
  const value = Array.isArray(section) ? section[0] : section
  if (value === "partners") permanentRedirect("/practice/debates?section=partners")
  const target = researchSectionForTeamSection(value)
  permanentRedirect(target ? researchHref(target) : "/research")
}
