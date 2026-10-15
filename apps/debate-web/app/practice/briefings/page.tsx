import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Pre-Round Briefings, merged into the Prep Workspace at
 * `/practice/prep`. It permanently redirects to its "briefings" tab.
 */

export const metadata: Metadata = {
  title: "Pre-Round Briefings",
  alternates: { canonical: "/practice/prep?section=briefings" },
}

export default function LegacyPreRoundBriefingsPage() {
  permanentRedirect("/practice/prep?section=briefings")
}
