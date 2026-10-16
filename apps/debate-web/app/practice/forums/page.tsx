import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of the forums feed, merged into News & Forums at `/news`.
 * It permanently redirects to its "forums" tab. Single threads still live at
 * `/practice/forums/<id>`.
 */

export const metadata: Metadata = {
  title: "Forums",
  alternates: { canonical: "/news?section=forums" },
}

export default function LegacyForumsPage() {
  permanentRedirect("/news?section=forums")
}
