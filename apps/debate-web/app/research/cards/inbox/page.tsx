import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of Task Inbox, merged into Team Research at
 * `/research/team`. It permanently redirects to its "inbox" tab.
 */

export const metadata: Metadata = {
  title: "Task Inbox",
  alternates: { canonical: "/research/team?section=inbox" },
}

export default function LegacyInboxPage() {
  permanentRedirect("/research/team?section=inbox")
}
