import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Every setting for the Debate Editor card editor — files, editing, appearance, accessibility, keyboard shortcuts, comments and AI, and collaboration",
}

export { default } from "@debate-ai/webview/routes/settings/page"
