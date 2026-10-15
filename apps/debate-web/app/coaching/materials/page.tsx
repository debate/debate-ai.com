import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Coach Materials, merged into Coaching at `/coaching`. It
 * permanently redirects to its "materials" tab.
 */

export const metadata: Metadata = {
  title: "Coach Materials",
  alternates: { canonical: "/coaching?section=materials" },
}

export default function LegacyMaterialsPage() {
  permanentRedirect("/coaching?section=materials")
}
