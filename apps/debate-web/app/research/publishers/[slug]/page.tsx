import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Research Publisher",
  description: "A research group's published debate files, its students and seasons, and its subscription",
}

export { default } from "@debate-ai/webview/routes/market/publishers/[slug]/page"
