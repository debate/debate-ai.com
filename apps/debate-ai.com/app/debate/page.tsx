import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Debate FIAT",
  description: "Flow Inteconnected Argument Tree",
}

export const dynamic = "force-dynamic"

export { default } from "debate-webview/routes/debate/page"
