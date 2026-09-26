import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "School Profile",
  description: "Debate school ranking stats and videos",
}

export { default } from "debate-webview/routes/schools/[school]/page"
