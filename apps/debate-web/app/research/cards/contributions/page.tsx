import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Contributions Feed, merged into the Research Workspace at
 * `/research` (it was a Team Research tab before that). It permanently
 * redirects to its "rewards" tab.
 */

export const metadata: Metadata = {
  title: "Contributions Feed",
  alternates: { canonical: "/research?section=rewards" },
}

export default function LegacyContributionsPage() {
  permanentRedirect("/research?section=rewards")
}
