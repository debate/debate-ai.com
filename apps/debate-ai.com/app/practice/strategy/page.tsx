import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Scout-to-Strategy, merged into the Prep Workspace at
 * `/practice/prep`. It permanently redirects to its "strategy" tab.
 */

export const metadata: Metadata = {
  title: "Scout-to-Strategy",
  alternates: { canonical: "/practice/prep?section=strategy" },
}

export default function LegacyScouttoStrategyPage() {
  permanentRedirect("/practice/prep?section=strategy")
}
