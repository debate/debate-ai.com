import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Topic & Video Statistics",
  description: "Statistics on debate topics and the video library",
}

export { default } from "@debate/webview/routes/videos/page"
