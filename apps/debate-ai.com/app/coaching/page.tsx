import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "AI Coach Mode",
  description: "Extension, refutation, collapse, and weighing prompts generated from each round's flow",
}

export { default } from "debate-webview/routes/coaching/page"
