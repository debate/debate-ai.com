import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Coach Materials",
  description: "Upload grounding materials for the team coach AI and preview which ones answer a question",
}

export { default } from "debate-webview/routes/coach-materials/page"
