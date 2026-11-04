import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Review Queue, merged into the Research Workspace at
 * `/research` (it was a Team Research tab before that). It permanently
 * redirects to its "review" tab.
 */

export const metadata: Metadata = {
  title: "Review Queue",
  alternates: { canonical: "/research?section=review" },
}

export default function LegacyReviewsPage() {
  permanentRedirect("/research?section=review")
}
