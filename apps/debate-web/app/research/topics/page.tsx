import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The Topics Explorer's old address, now folded into the Topic & Video
 * Statistics page at `/practice/statistics`.
 *
 * The research-area explorer — every resolution since 2000, split into 44
 * research areas and ranked by how often each has been debated — is now the
 * first section of that page, beside the per-season video numbers and the
 * YouTube channel charts. One page answers "what has been debated" and "how
 * much of it is on the channel" rather than making a reader cross two routes
 * to join the two halves.
 *
 * `/research/topics` is a real address in the wild: it sits in the Research
 * sidebar section and is linked from there and from older docs, so it stays
 * live as a permanent redirect rather than 404ing.
 */

export const metadata: Metadata = {
  title: "Debate Topics Explorer",
  description:
    "Every NDT, Policy, LD and PF resolution since 2000, split into 44 research areas, ranked by how often each has been debated, with a year-by-year trend and the video library's own season statistics.",
  // The page redirects, so this is only read by a crawler that does not
  // follow it. Point it at the canonical address either way.
  alternates: { canonical: "/practice/statistics" },
}

/** The explorer lives on `/practice/statistics` now; this route only redirects
 *  there — see `debate-videos`' `StatisticsPage`. */
export default function LegacyResearchTopicsPage() {
  permanentRedirect("/practice/statistics")
}