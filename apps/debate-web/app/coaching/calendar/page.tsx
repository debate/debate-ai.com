import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Team Calendar, merged into Coaching at `/coaching`. It
 * permanently redirects to its "calendar" tab.
 */

export const metadata: Metadata = {
  title: "Team Calendar",
  alternates: { canonical: "/coaching?section=calendar" },
}

export default function LegacyCalendarPage() {
  permanentRedirect("/coaching?section=calendar")
}
