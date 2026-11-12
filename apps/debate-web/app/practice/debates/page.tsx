import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Practice Debates",
  description:
    "Online Challenges against players or the AI, Practice Drills from each round's flow, and Practice Partners with the Judge Pool, on one page",
}

/**
 * Practice Debates: Online Challenges, Practice Drills and Practice Partners,
 * one tab each, in the sidebar's Practice Debates section.
 */
export { default } from "@debate-ai/webview/routes/practice-debates/page"
