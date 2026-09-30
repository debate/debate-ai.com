import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Team Brainstorm Assist",
  description: "Submit and upvote squad ideas for an argument block, grouped into boards by category",
}

export { default } from "debate-webview/routes/cards/brainstorm/page"
