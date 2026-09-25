import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Speech Transcript Summaries",
  description: "Per-argument summaries derived from each round's flow, with cross-exam questions and extension ideas",
}

export { default } from "debate-ai-webui/routes/summaries/page"
