import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Practice Drills, merged into the Prep Workspace at
 * `/practice/prep`. It permanently redirects to its "drills" tab.
 */

export const metadata: Metadata = {
  title: "Practice Drills",
  alternates: { canonical: "/practice/prep?section=drills" },
}

export default function LegacyPracticeDrillsPage() {
  permanentRedirect("/practice/prep?section=drills")
}
