import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "AI Judge Decision",
  description: "AI-generated round decisions under a round's saved judge paradigm and flow summary",
}

export { default } from "debate-ai-webui/routes/judge-decision/page"
