import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Collaboration Prep Room, merged into the Research Workspace at
 * `/research` (it was a Team Research tab before that). It permanently
 * redirects to its "sprint" tab.
 */

export const metadata: Metadata = {
  title: "Collaboration Prep Room",
  alternates: { canonical: "/research?section=sprint" },
}

export default function LegacyPrepRoomPage() {
  permanentRedirect("/research?section=sprint")
}
