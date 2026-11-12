import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Practice Drills, merged into Practice Debates at
 * `/practice/debates`. It permanently redirects to its tab; a `#fragment`
 * survives the redirect.
 */

export const metadata: Metadata = {
  title: "Practice Drills",
  alternates: { canonical: "/practice/debates?section=drills" },
}

export default function LegacyDrillsPage() {
  permanentRedirect("/practice/debates?section=drills")
}
