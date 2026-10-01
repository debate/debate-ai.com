import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Debate Topics Explorer",
  description:
    "Every NDT, Policy, LD and PF resolution since 2000, split into 44 research areas, ranked by how often each has been debated, with a year-by-year trend. Now part of the Topic & Video Statistics page.",
}

/** The explorer lives on `/practice/statistics` now; this route only redirects
 *  there — see `debate-webview/routes/topics/page`. */
export { default } from "debate-webview/routes/topics/page"
