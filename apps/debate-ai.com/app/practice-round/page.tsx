import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Practice Round Simulator",
  description: "Recreate a tournament round with a timer, judge paradigm, and AI opponent persona",
}

export { default } from "debate-ai-webui/routes/practice-round/page"
