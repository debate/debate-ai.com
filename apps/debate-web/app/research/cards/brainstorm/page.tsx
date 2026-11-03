import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Team Brainstorm Assist, merged into the Research Workspace at
 * `/research` (it was a Team Research tab before that). It permanently
 * redirects to its "sprint" tab.
 */

export const metadata: Metadata = {
  title: "Team Brainstorm Assist",
  alternates: { canonical: "/research?section=sprint" },
}

export default function LegacyBrainstormPage() {
  permanentRedirect("/research?section=sprint")
}
