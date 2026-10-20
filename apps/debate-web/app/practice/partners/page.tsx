import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Practice Partners, merged into the Prep Workspace at
 * `/practice/prep`. It permanently redirects to its "partners" tab; a
 * `#judge-pool` fragment survives the redirect.
 */

export const metadata: Metadata = {
  title: "Practice Partners",
  alternates: { canonical: "/practice/prep?section=partners" },
}

export default function LegacyPracticePartnersPage() {
  permanentRedirect("/practice/prep?section=partners")
}
