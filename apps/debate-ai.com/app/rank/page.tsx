import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Rankings",
  description: "Debate team rankings, leaderboard, and Elo ratings",
}

export { default } from "debate-webview/routes/rank/page"
