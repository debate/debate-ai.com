import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Team Profile",
  description: "Debate team ranking stats and videos",
}

export { default } from "debate-webview/routes/teams/[team]/page"
