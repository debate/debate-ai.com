import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Topic Coverage Dashboard",
  description: "See which arguments are well-covered, which are missing, and where the team needs more work",
}

export { default } from "debate-ai-webui/routes/cards/coverage/page"
