import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Team Brainstorm Assist, merged into Team Research at
 * `/research/team`. It permanently redirects to its "brainstorm" tab.
 */

export const metadata: Metadata = {
  title: "Team Brainstorm Assist",
  alternates: { canonical: "/research/team?section=brainstorm" },
}

export default function LegacyBrainstormPage() {
  permanentRedirect("/research/team?section=brainstorm")
}
