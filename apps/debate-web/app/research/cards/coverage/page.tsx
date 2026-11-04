import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Topic Coverage Dashboard, merged into the Research Workspace at
 * `/research` (it was a Team Research tab before that). It permanently
 * redirects to its "coverage" tab.
 */

export const metadata: Metadata = {
  title: "Topic Coverage Dashboard",
  alternates: { canonical: "/research?section=coverage" },
}

export default function LegacyCoveragePage() {
  permanentRedirect("/research?section=coverage")
}
