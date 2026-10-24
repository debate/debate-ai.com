import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Lectures",
  description: "Lectures from educators on every debate format, skill and topic",
}

export { default } from "@debate-ai/webview/routes/videos/[category]/page"
