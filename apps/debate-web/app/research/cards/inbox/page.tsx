import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Task Inbox, merged into the Research Workspace at
 * `/research` (it was a Team Research tab before that). It permanently
 * redirects to its "routing" tab.
 */

export const metadata: Metadata = {
  title: "Task Inbox",
  alternates: { canonical: "/research?section=routing" },
}

export default function LegacyInboxPage() {
  permanentRedirect("/research?section=routing")
}
