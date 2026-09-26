import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Debater Level",
  description: "Earn XP and level up by completing challenges like cutting 5 cards or redoing a rebuttal",
}

export { default } from "debate-webview/routes/cards/level/page"
