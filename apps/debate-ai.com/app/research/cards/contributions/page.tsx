import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Contributions Feed, merged into Team Research at
 * `/research/team`. It permanently redirects to its "contributions" tab.
 */

export const metadata: Metadata = {
  title: "Contributions Feed",
  alternates: { canonical: "/research/team?section=contributions" },
}

export default function LegacyContributionsPage() {
  permanentRedirect("/research/team?section=contributions")
}
