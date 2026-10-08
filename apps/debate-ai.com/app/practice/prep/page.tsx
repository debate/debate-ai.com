import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Prep Workspace",
  description:
    "Pre-round briefings, scout-to-strategy, opponent team profiles, judge profiles and prep notes on one page",
}

export { default } from "@debate/webview/routes/prep/page"
