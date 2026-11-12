import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Online Challenges, merged into Practice Debates at
 * `/practice/debates`. It permanently redirects to its tab; a `#fragment`
 * survives the redirect.
 */

export const metadata: Metadata = {
  title: "Online Challenges",
  alternates: { canonical: "/practice/debates" },
}

export default function LegacyChallengesPage() {
  permanentRedirect("/practice/debates")
}
