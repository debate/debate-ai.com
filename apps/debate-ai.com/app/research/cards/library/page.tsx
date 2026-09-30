import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Shared Evidence Library",
  description: "Search cut cards and reusable analytic blocks by keyword, citation, or argument",
}

export { default } from "debate-webview/routes/cards/library/page"
