import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Debater Level, now a tab of the Research Workspace at
 * `/research`. It permanently redirects to its "level" tab.
 */

export const metadata: Metadata = {
  title: "Debater Level",
  alternates: { canonical: "/research?section=level" },
}

export default function LegacyDebaterLevelPage() {
  permanentRedirect("/research?section=level")
}
