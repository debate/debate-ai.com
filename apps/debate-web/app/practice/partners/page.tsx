import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Practice Partners, now the first tab of Team Research
 * at `/research/team`. It permanently redirects to its "partners" tab; a
 * `#judge-pool` fragment survives the redirect.
 */

export const metadata: Metadata = {
  title: "Practice Partners",
  alternates: { canonical: "/research/team?section=partners" },
}

export default function LegacyPracticePartnersPage() {
  permanentRedirect("/research/team?section=partners")
}
