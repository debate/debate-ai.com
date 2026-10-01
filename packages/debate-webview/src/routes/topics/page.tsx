import { redirect } from "next/navigation"

/**
 * `/research/topics` — the Debate Topics Explorer used to be its own page
 * under Research. Its topic-area breakdown is now the middle section of the
 * Topic & Video Statistics page, so this route only redirects there, keeping
 * old links and bookmarks working (the same treatment
 * `/settings/preferences` gets).
 */
export default function TopicsPage(): never {
  redirect("/practice/statistics")
}
