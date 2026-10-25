import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Debater Level, moved into Team Research at
 * `/research/team`. It permanently redirects to its "level" tab.
 */

export const metadata: Metadata = {
  title: "Debater Level",
  alternates: { canonical: "/research/team?section=level" },
}

export default function LegacyDebaterLevelPage() {
  permanentRedirect("/research/team?section=level")
}
