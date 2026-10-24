import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Forum Thread",
  description: "A community thread and its replies.",
}

export { default } from "@debate-ai/webview/routes/forums/[threadId]/page"
