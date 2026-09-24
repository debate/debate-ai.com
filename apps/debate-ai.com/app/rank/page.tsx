import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Rankings",
  description: "Debate team rankings, leaderboard, and Elo ratings",
}

export { default } from "debate-ai-webui/routes/rank/page"
