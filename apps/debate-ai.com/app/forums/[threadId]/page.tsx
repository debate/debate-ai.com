import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Forum Thread",
  description: "A forum thread and its replies.",
}

export { default } from "debate-webview/routes/forums/[threadId]/page"
