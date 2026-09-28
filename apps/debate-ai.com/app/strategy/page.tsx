import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Scout-to-Strategy",
  description: "Case-choice rankings, judge-adaptation notes, and matchup risk level from scouted opponent and judge data",
}

export { default } from "debate-webview/routes/strategy/page"
