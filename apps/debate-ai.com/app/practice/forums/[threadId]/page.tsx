import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Latest News Thread",
  description: "A community thread and its replies.",
}

export { default } from "@debate/webview/routes/forums/[threadId]/page"
