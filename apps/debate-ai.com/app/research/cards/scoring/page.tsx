import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "LLM Card Scoring",
  description: "Score cards for relevance, clarity, uniqueness, evidence quality, and usability",
}

export { default } from "debate-webview/routes/cards/scoring/page"
