import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Daily Quests",
  description: "Team goals like \"find 5 solvency cards\" — today's live progress against real contributions",
}

export { default } from "debate-webview/routes/cards/quests/page"
