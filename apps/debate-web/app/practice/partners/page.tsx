import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Practice Partners, merged into Practice Debates at
 * `/practice/debates`. It permanently redirects to its tab; a `#fragment`
 * survives the redirect.
 */

export const metadata: Metadata = {
  title: "Practice Partners",
  alternates: { canonical: "/practice/debates?section=partners" },
}

export default function LegacyPartnersPage() {
  permanentRedirect("/practice/debates?section=partners")
}
