import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Coaching Programs, merged into Coaching at `/coaching`. It
 * permanently redirects to its "programs" tab.
 */

export const metadata: Metadata = {
  title: "Coaching Programs",
  alternates: { canonical: "/coaching?section=programs" },
}

export default function LegacyProgramsPage() {
  permanentRedirect("/coaching?section=programs")
}
