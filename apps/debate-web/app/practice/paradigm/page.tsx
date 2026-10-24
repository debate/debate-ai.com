import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Your Judge Paradigm",
  description: "Write your judging paradigm, link it to your Tabroom judge account, and show it to debaters who click your name in tournament pairings.",
}

export { default } from "@debate-ai/webview/routes/paradigm/page"
