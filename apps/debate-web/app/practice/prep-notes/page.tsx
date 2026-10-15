import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Prep Notes, merged into the Prep Workspace at
 * `/practice/prep`. It permanently redirects to its "notes" tab.
 */

export const metadata: Metadata = {
  title: "Prep Notes",
  alternates: { canonical: "/practice/prep?section=notes" },
}

export default function LegacyPrepNotesPage() {
  permanentRedirect("/practice/prep?section=notes")
}
