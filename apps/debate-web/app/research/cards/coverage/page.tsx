import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Topic Coverage Dashboard, merged into Team Research at
 * `/research/team`. It permanently redirects to its "coverage" tab.
 */

export const metadata: Metadata = {
  title: "Topic Coverage Dashboard",
  alternates: { canonical: "/research/team?section=coverage" },
}

export default function LegacyCoveragePage() {
  permanentRedirect("/research/team?section=coverage")
}
