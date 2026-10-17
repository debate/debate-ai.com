import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Opponent Team Profiles, merged into the Prep Workspace at
 * `/practice/prep`. It permanently redirects to its "opponents" tab.
 */

export const metadata: Metadata = {
  title: "Opponent Team Profiles",
  alternates: { canonical: "/practice/prep?section=opponents" },
}

export default function LegacyOpponentTeamProfilesPage() {
  permanentRedirect("/practice/prep?section=opponents")
}
