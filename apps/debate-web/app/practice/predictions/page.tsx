import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Prediction Markets",
  description: "Bet play-money points on who wins a debate, who wins a tournament, and whose team rating goes up",
}

export { default } from "@debate/webview/routes/predictions/page"
