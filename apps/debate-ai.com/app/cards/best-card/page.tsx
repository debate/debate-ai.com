import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Daily Best Card Challenge",
  description: "Today's highest-helpfulness card, plus every past day's winner",
}

export { default } from "debate-ai-webui/routes/cards/best-card/page"
