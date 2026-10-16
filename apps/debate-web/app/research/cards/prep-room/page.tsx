import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Collaboration Prep Room, merged into Team Research at
 * `/research/team`. It permanently redirects to its "prep-room" tab.
 */

export const metadata: Metadata = {
  title: "Collaboration Prep Room",
  alternates: { canonical: "/research/team?section=prep-room" },
}

export default function LegacyPrepRoomPage() {
  permanentRedirect("/research/team?section=prep-room")
}
