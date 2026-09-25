import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Review Queue",
  description: "Move a submitted card through peer review — comment, request changes, approve, and publish",
}

export { default } from "debate-ai-webui/routes/cards/reviews/page"
