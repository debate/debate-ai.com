import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Pre-Round Briefings",
  description: "Opponent scouting, judge tendencies, head-to-head record, and prep notes per round",
}

export { default } from "debate-webview/routes/briefings/page"
