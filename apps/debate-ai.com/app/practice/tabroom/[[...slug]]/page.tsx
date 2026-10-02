import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Tabroom",
  description: "Tabroom's own site, framed: invitations, pairings, results and registration.",
}

export { default } from "@debate/webview/routes/tabroom/[[...slug]]/page"