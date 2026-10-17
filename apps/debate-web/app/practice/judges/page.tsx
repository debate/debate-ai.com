import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Judge Profiles, merged into the Prep Workspace at
 * `/practice/prep`. It permanently redirects to its "judges" tab.
 */

export const metadata: Metadata = {
  title: "Judge Profiles",
  alternates: { canonical: "/practice/prep?section=judges" },
}

export default function LegacyJudgeProfilesPage() {
  permanentRedirect("/practice/prep?section=judges")
}
