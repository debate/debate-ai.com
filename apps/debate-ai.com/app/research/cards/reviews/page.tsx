import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Review Queue, merged into Team Research at
 * `/research/team`. It permanently redirects to its "reviews" tab.
 */

export const metadata: Metadata = {
  title: "Review Queue",
  alternates: { canonical: "/research/team?section=reviews" },
}

export default function LegacyReviewsPage() {
  permanentRedirect("/research/team?section=reviews")
}
