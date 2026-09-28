import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Argument Tree Outline",
  description: "Filterable outline of each round's flow, grouped by heading",
}

export { default } from "debate-webview/routes/outline/page"
