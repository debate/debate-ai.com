import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Unsubscribe",
  description: "Opt out of all Debate AI emails",
  robots: { index: false, follow: false },
}

export { default } from "@debate-ai/webview/routes/unsubscribe/page"
