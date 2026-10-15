import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The old address of AI Coach Mode, merged into Coaching at `/coaching`. It
 * permanently redirects to its "ai-coach" tab.
 */

export const metadata: Metadata = {
  title: "AI Coach Mode",
  alternates: { canonical: "/coaching?section=ai-coach" },
}

export default function LegacyAiCoachPage() {
  permanentRedirect("/coaching?section=ai-coach")
}
