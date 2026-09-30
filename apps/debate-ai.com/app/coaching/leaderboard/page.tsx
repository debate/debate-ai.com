import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contribution Leaderboard",
  description: "Ranked contributors by helpfulness score, tier, badges, and quest streak",
}

export { default } from "debate-webview/routes/cards/leaderboard/page"
