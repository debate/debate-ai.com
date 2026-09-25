import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Word-Count Speeches",
  description: "Practice speeches bounded by a maximum word count instead of a time limit",
}

export { default } from "debate-ai-webui/routes/word-count/page"
