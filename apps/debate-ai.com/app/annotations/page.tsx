import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Flow-in-Speech Annotations",
  description: "Drop timestamped flow annotations while watching a streamed or recorded round, and jump back to them",
}

export { default } from "debate-ai-webui/routes/annotations/page"
