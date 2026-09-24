import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Task Inbox",
  description: "Research tasks routed to contributors, grouped by topic",
}

export { default } from "debate-ai-webui/routes/cards/inbox/page"
